import { readFileSync, writeFileSync } from "node:fs";
import { createRemoveCommand, findOrphanedNpmDeps } from "@diffgazer/registry/cli";
import { ctx, type DiffgazerAddConfig, type ResolvedConfig } from "../context.js";
import { readInstalledCssChunkHashes, removeCssChunks } from "../utils/css-chunks.js";
import { sha256 } from "../utils/hashing.js";
import {
  getKeysHookNames,
  resolveKeysCopyHookFiles,
  resolveKeysHooksFromRegistry,
} from "../utils/keys-copy-bundle.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  validateInstallNames,
} from "../utils/namespaces.js";
import { normalizeManifestPath, resolveInstallPath, resolveProjectPath } from "../utils/paths.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../utils/registry.js";

type ManifestEntry = NonNullable<DiffgazerAddConfig["installedComponents"]>[string];
type Manifest = Record<string, ManifestEntry>;

function ownedFileHash(cwd: string, itemName: string, absolutePath: string): string | null {
  const parsed = parseInstallName(itemName);

  const config = ctx.config.loadConfig(cwd);
  if (!config.ok) return null;

  const manifest = config.config.installedComponents ?? {};
  const record = manifest[parsed.publicName];
  const files = record?.files ?? [];
  const filePath = normalizeManifestPath(cwd, absolutePath);
  return files.find((file) => file.path === filePath)?.hash ?? null;
}

function hasCopyModeFiles(record: ManifestEntry): boolean {
  return (
    record.integrationMode === "copy" ||
    (record.files ?? []).some((file) => file.integrationMode === "copy")
  );
}

function loadManifest(cwd: string): Manifest {
  return (ctx.config.getManifestItems(cwd) ?? {}) as Manifest;
}

function uiRegistryDependencyNames(installedName: string): string[] {
  const parsed = parseInstallName(installedName);
  if (parsed.namespace !== "ui") return [];
  if (!ctx.registry.getItem(parsed.name)) return [];
  return ctx.registry.resolveDeps([parsed.name]).filter((n) => n !== parsed.name);
}

function dependentsOf(candidate: string, manifest: Manifest, removed: Set<string>): string[] {
  const parsed = parseInstallName(candidate);
  const dependents = new Set<string>();

  for (const installedName of Object.keys(manifest)) {
    if (removed.has(installedName) || installedName === candidate) continue;
    const installedParsed = parseInstallName(installedName);

    if (parsed.namespace === "ui" && installedParsed.namespace === "ui") {
      if (uiRegistryDependencyNames(installedName).includes(parsed.name)) {
        dependents.add(installedName);
      }
      continue;
    }

    if (parsed.namespace === "keys" && installedParsed.namespace === "ui") {
      const record = manifest[installedName];
      if (!record || !hasCopyModeFiles(record)) continue;
      const registryItem = ctx.registry.getItem(installedParsed.name);
      if (!registryItem) continue;
      if (resolveKeysHooksFromRegistry([registryItem]).includes(parsed.name)) {
        dependents.add(installedName);
      }
    }
  }

  return [...dependents];
}

interface ExpansionPlan {
  toRemove: string[];
  blocked: Array<{ name: string; dependents: string[] }>;
}

// Cascade orphan transitives whose dependents are all being removed, then
// surface explicitly-requested items that retained installed items still need.
function expandRemoval(cwd: string, requestedNames: string[]): ExpansionPlan {
  const manifest = loadManifest(cwd);
  const requestedPublicNames = new Set(requestedNames.map((n) => parseInstallName(n).publicName));
  const removed = new Set<string>();
  const manifestAbsent = Object.keys(manifest).length === 0;

  for (const name of requestedPublicNames) {
    // When manifest is absent, include the requested name anyway so the
    // downstream file-resolution logic can reconstruct paths from the registry.
    if (manifest[name] || manifestAbsent) removed.add(name);
  }

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [installedName, record] of Object.entries(manifest)) {
      if (removed.has(installedName)) continue;
      if (record.installedAs !== "transitive") continue;
      if (dependentsOf(installedName, manifest, removed).length === 0) {
        removed.add(installedName);
        progressed = true;
      }
    }
  }

  const blocked: Array<{ name: string; dependents: string[] }> = [];
  for (const name of requestedPublicNames) {
    if (!manifest[name]) continue;
    const dependents = dependentsOf(name, manifest, removed);
    if (dependents.length > 0) {
      blocked.push({ name, dependents });
      removed.delete(name);
    }
  }

  return { toRemove: [...removed], blocked };
}

function manifestItemsForResolve(cwd: string): ReturnType<typeof getNamespacedItem>[] {
  return Object.keys(loadManifest(cwd))
    .filter((name) => name.includes("/"))
    .map(getNamespacedItem);
}

function removeOwnedCssChunks(
  cwd: string,
  config: ResolvedConfig,
  removedNames: string[],
  preRemovalChunksByItem: Map<string, string[]>,
): void {
  if (removedNames.length === 0) return;
  const installedHashes = readInstalledCssChunkHashes(cwd, config);
  if (installedHashes.size === 0) return;

  // onAfterRemove fires after updateManifest, so the live manifest no longer
  // lists removed items. Compute kept and removed chunk sets from the
  // pre-removal snapshot captured during expandRequestedNames.
  const removedSet = new Set(removedNames);
  const keptChunkHashes = new Set<string>();
  const chunksOfRemovedItems = new Set<string>();
  for (const [name, hashes] of preRemovalChunksByItem) {
    const target = removedSet.has(name) ? chunksOfRemovedItems : keptChunkHashes;
    for (const hash of hashes) target.add(hash);
  }

  const candidates = new Set<string>();
  for (const hash of installedHashes) {
    if (chunksOfRemovedItems.has(hash) && !keptChunkHashes.has(hash)) {
      candidates.add(hash);
    }
  }
  if (candidates.size === 0) return;

  const result = removeCssChunks(candidates, cwd, config);
  if (result.fileOp) writeFileSync(result.fileOp.targetPath, result.fileOp.content);
}

// The remove workflow invokes its callbacks in phases that cannot pass state to
// one another through arguments:
//   - `getAllItems` runs with no cwd; the workflow calls `requireConfig(cwd)`
//     first, so the active cwd captured there is the one to resolve against.
//   - `onAfterRemove` runs before `updateManifest`, but the pre-removal
//     cssChunks must still be snapshotted during expandRequestedNames so CSS
//     during `expandRequestedNames` (before any deletion) and read back later.
// The registry command factory (B7-owned) cannot thread a per-call context
// through these callbacks, so the state lives in one object instead of loose
// module-level bindings. `beginInvocation` resets it on the first callback
// (`requireConfig`) so a previous `dgadd remove` run can never bleed cwd or
// chunk snapshots into the next within a long-lived process.
export interface RemoveWorkflowContext {
  readonly activeCwd: string | null;
  readonly preRemovalChunksByItem: Map<string, string[]>;
  beginInvocation(cwd: string): void;
  snapshotPreRemovalChunks(chunksByItem: Map<string, string[]>): void;
}

export function createRemoveWorkflowContext(): RemoveWorkflowContext {
  let activeCwd: string | null = null;
  let preRemovalChunksByItem = new Map<string, string[]>();
  return {
    get activeCwd() {
      return activeCwd;
    },
    get preRemovalChunksByItem() {
      return preRemovalChunksByItem;
    },
    beginInvocation(cwd) {
      activeCwd = cwd;
      preRemovalChunksByItem = new Map();
    },
    snapshotPreRemovalChunks(chunksByItem) {
      preRemovalChunksByItem = chunksByItem;
    },
  };
}

function readPreRemovalChunks(cwd: string): Map<string, string[]> {
  const manifest = loadManifest(cwd);
  const snapshot = new Map<string, string[]>();
  for (const [name, record] of Object.entries(manifest)) {
    const hashes = record.cssChunks ?? [];
    if (hashes.length > 0) snapshot.set(name, [...hashes]);
  }
  return snapshot;
}

function resolveKeyName(itemName: string): string | null {
  const parsed = parseInstallName(itemName);
  if (parsed.namespace === "keys") return parsed.name;
  if (getKeysHookNames().has(itemName)) return itemName;
  return null;
}

const removeWorkflow = createRemoveWorkflowContext();

export const removeCommand = createRemoveCommand({
  itemPlural: "items",
  requireConfig: (cwd) => {
    removeWorkflow.beginInvocation(cwd);
    return ctx.items.requireConfig(cwd);
  },
  validateNames: validateInstallNames,
  getAllItems: () =>
    removeWorkflow.activeCwd ? manifestItemsForResolve(removeWorkflow.activeCwd) : [],
  getItemOrThrow: getNamespacedItem,
  getItemName: (item) => item.name,
  isInstalled: ({ cwd, config, item }) => {
    return isNamespacedInstalled(cwd, config, item.name);
  },
  resolveFilesForItem: ({ cwd, config, item }) => {
    const keyName = resolveKeyName(item.name);
    if (keyName) {
      const { files, missingHooks } = resolveKeysCopyHookFiles([keyName]);
      if (missingHooks.length > 0) {
        throw new Error(`Missing bundled keys hook(s): ${missingHooks.join(", ")}`);
      }
      return files.map((file) => ({
        absolutePath: resolveInstallPath(cwd, config.hooksFsPath, file.relativePath),
      }));
    }

    return item.files.map((file) => {
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      return { absolutePath: resolveInstallPath(cwd, installDir, ctx.registry.relativePath(file)) };
    });
  },
  canRemoveFile: ({ cwd, item, file, force }) => {
    if (force) return true;
    const expectedHash = ownedFileHash(cwd, item.name, file.absolutePath);
    if (!expectedHash) return false;
    return sha256(readFileSync(file.absolutePath, "utf-8")) === expectedHash;
  },
  resolveAllowedBaseDirs: ({ cwd, config }) => [
    resolveProjectPath(cwd, config.componentsFsPath),
    resolveProjectPath(cwd, config.hooksFsPath),
    resolveProjectPath(cwd, config.libFsPath),
    resolveProjectPath(cwd, config.stylesFsPath),
  ],
  updateManifest: ({ cwd, removedNames }) => {
    const names = removedNames.map((name) => parseInstallName(name).publicName);
    ctx.config.updateManifest(cwd, undefined, names);
  },
  findOrphanedDeps: ({ removedNames, cwd, config }) => {
    const checker = ctx.createChecker(cwd, config.componentsFsPath);
    const removedUiNames = removedNames
      .map(parseInstallName)
      .filter((name) => name.namespace === "ui")
      .map((name) => name.name);
    return findOrphanedNpmDeps({
      removedNames: removedUiNames,
      getAllItems: ctx.registry.getAllItems,
      getItemName: (c) => c.name,
      getItemDeps: (c) => c.dependencies,
      isInstalled: (c) => checker(c.name),
    });
  },
  expandRequestedNames: ({ cwd, names }) => {
    removeWorkflow.snapshotPreRemovalChunks(readPreRemovalChunks(cwd));
    return expandRemoval(cwd, names);
  },
  onAfterRemove: ({ cwd, config, removedNames }) => {
    removeOwnedCssChunks(cwd, config, removedNames, removeWorkflow.preRemovalChunksByItem);
  },
});
