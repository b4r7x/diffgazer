import { readFileSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import { createRemoveCommand, findOrphanedNpmDeps } from "@diffgazer/registry/cli";
import { ctx, type ManifestItem, type ResolvedConfig } from "../context.js";
import { readInstalledCssChunkHashes, removeCssChunks } from "../utils/css-chunks.js";
import {
  getKeysHookNames,
  resolveKeysCopyHookFiles,
  resolveKeysHooksFromRegistry,
} from "../utils/keys-copy-bundle.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  validateInstallableNames,
} from "../utils/namespaces.js";
import { normalizeManifestPath, resolveInstallPath, resolveProjectPath } from "../utils/paths.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../utils/registry.js";

type Manifest = Record<string, ManifestItem>;

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

function hasCopyModeFiles(record: ManifestItem): boolean {
  return (
    record.integrationMode === "copy" ||
    (record.files ?? []).some((file) => file.integrationMode === "copy")
  );
}

function loadManifest(cwd: string): Manifest {
  return ctx.config.getManifestItems(cwd) ?? {};
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

// Cascade orphan transitives whose dependents are all being removed, then block
// explicitly-requested items that retained installed items still need.
function expandRemoval(cwd: string, requestedNames: string[]): ExpansionPlan {
  const manifest = loadManifest(cwd);
  const requestedPublicNames = new Set(requestedNames.map((n) => parseInstallName(n).publicName));
  const removed = new Set<string>();
  const manifestAbsent = Object.keys(manifest).length === 0;

  for (const name of requestedPublicNames) {
    // With no manifest, include the requested name so downstream file resolution
    // can reconstruct paths from the registry.
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

interface OwnedCssRemovalPlan {
  writes: Array<{ targetPath: string; content: string }>;
  preservedNotices: string[];
  // Removed items whose drifted chunk was preserved; kept in the manifest so the
  // leftover block stays targetable by a later `remove <item> --force`.
  retainedNames: string[];
  // Per retained item, the chunk hashes actually preserved on disk, used to trim
  // `cssChunks` so a deleted pristine sibling chunk is dropped, not reported as drift.
  retainedChunkHashesByName: Map<string, string[]>;
}

// Surfaces a preserved (drifted) CSS chunk with the same "use --force to
// override" guidance the remove workflow emits for edited owned source files.
function cssDriftNotice(
  hash: string,
  preRemovalChunksByItem: Map<string, string[]>,
  stylesPath: string,
): string {
  const owners = [...preRemovalChunksByItem]
    .filter(([, hashes]) => hashes.includes(hash))
    .map(([name]) => name);
  const label = owners.length > 0 ? owners.join(", ") : "CSS chunk";
  return `Skipping ${label}: ${stylesPath} chunk has been modified (use --force to override). Keeping ${label} tracked so the edited chunk is not orphaned; re-run remove with --force to delete it.`;
}

// Plans the styles.css mutation without touching disk so the workflow can
// preview it under --dry-run. Without `force`, a drifted chunk is preserved and
// reported via a skip notice.
export function planOwnedCssChunkRemoval(
  cwd: string,
  config: ResolvedConfig,
  removedNames: string[],
  preRemovalChunksByItem: Map<string, string[]>,
  force: boolean,
): OwnedCssRemovalPlan {
  const empty: OwnedCssRemovalPlan = {
    writes: [],
    preservedNotices: [],
    retainedNames: [],
    retainedChunkHashesByName: new Map(),
  };
  if (removedNames.length === 0) return empty;
  const stylesPath = config.tailwind?.css;
  if (!stylesPath) return empty;
  const installedHashes = readInstalledCssChunkHashes(cwd, config);
  if (installedHashes.size === 0) return empty;

  // onAfterRemove fires before updateManifest, so the live manifest still lists
  // the removed items; derive kept vs removed chunks from the pre-removal snapshot.
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
  if (candidates.size === 0) return empty;

  const result = removeCssChunks(candidates, cwd, config, force);
  const preservedNotices = result.modifiedHashes.map((hash) =>
    cssDriftNotice(hash, preRemovalChunksByItem, stylesPath),
  );
  const modifiedHashes = new Set(result.modifiedHashes);
  const retainedChunkHashesByName = new Map<string, string[]>();
  const retainedNames = removedNames.filter((name) => {
    const preserved = (preRemovalChunksByItem.get(name) ?? []).filter((hash) =>
      modifiedHashes.has(hash),
    );
    if (preserved.length === 0) return false;
    retainedChunkHashesByName.set(name, preserved);
    return true;
  });
  const writes = result.fileOp
    ? [{ targetPath: result.fileOp.targetPath, content: result.fileOp.content }]
    : [];
  return { writes, preservedNotices, retainedNames, retainedChunkHashesByName };
}

// The registry command factory cannot thread a per-call context through its
// phased callbacks (getAllItems runs with no cwd; onAfterRemove runs before
// updateManifest), so state lives in one object rather than module-level
// bindings. `beginInvocation` MUST reset it on the first callback (requireConfig)
// so a previous `dgadd remove` run cannot bleed cwd or chunk snapshots into the
// next within a long-lived process.
export interface RemoveWorkflowContext {
  readonly activeCwd: string | null;
  readonly preRemovalChunksByItem: Map<string, string[]>;
  readonly retainedChunkHashesByName: Map<string, string[]>;
  beginInvocation(cwd: string): void;
  snapshotPreRemovalChunks(chunksByItem: Map<string, string[]>): void;
  retainDriftedChunkHashes(chunkHashesByName: Map<string, string[]>): void;
}

export function createRemoveWorkflowContext(): RemoveWorkflowContext {
  let activeCwd: string | null = null;
  let preRemovalChunksByItem = new Map<string, string[]>();
  let retainedChunkHashesByName = new Map<string, string[]>();
  return {
    get activeCwd() {
      return activeCwd;
    },
    get preRemovalChunksByItem() {
      return preRemovalChunksByItem;
    },
    get retainedChunkHashesByName() {
      return retainedChunkHashesByName;
    },
    beginInvocation(cwd) {
      activeCwd = cwd;
      preRemovalChunksByItem = new Map();
      retainedChunkHashesByName = new Map();
    },
    snapshotPreRemovalChunks(chunksByItem) {
      preRemovalChunksByItem = chunksByItem;
    },
    retainDriftedChunkHashes(chunkHashesByName) {
      retainedChunkHashesByName = chunkHashesByName;
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

function toPublicName(itemName: string): string {
  return parseInstallName(itemName).publicName;
}

// Trims records kept only for a drifted CSS chunk down to chunk tracking plus
// provenance. Their source files were deleted, so keeping `files` would make
// `dgadd diff` report spurious drift; `cssChunks` is narrowed to the hashes
// actually preserved on disk so a deleted pristine sibling chunk is dropped too.
export function retainCssChunkTrackingOnly(
  cwd: string,
  preservedChunksByName: Map<string, string[]>,
): void {
  if (preservedChunksByName.size === 0) return;
  const result = ctx.config.loadConfig(cwd);
  if (!result.ok) return;
  const manifest = result.config.installedComponents;
  if (!manifest) return;
  for (const [name, preservedHashes] of preservedChunksByName) {
    const record = manifest[name];
    if (!record) continue;
    const trimmed: ManifestItem = { installedAt: record.installedAt };
    if (record.installedAs) trimmed.installedAs = record.installedAs;
    if (record.integrationMode) trimmed.integrationMode = record.integrationMode;
    const preserved = new Set(preservedHashes);
    const retainedChunks = (record.cssChunks ?? []).filter((hash) => preserved.has(hash));
    if (retainedChunks.length > 0) trimmed.cssChunks = retainedChunks;
    manifest[name] = trimmed;
  }
  ctx.config.writeConfig(cwd, result.config);
}

const removeWorkflow = createRemoveWorkflowContext();

export const removeCommand = createRemoveCommand({
  itemPlural: "items",
  requireConfig: (cwd) => {
    removeWorkflow.beginInvocation(cwd);
    return ctx.items.requireConfig(cwd);
  },
  validateNames: validateInstallableNames,
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
    return computeIntegrity(readFileSync(file.absolutePath, "utf-8")) === expectedHash;
  },
  resolveAllowedBaseDirs: ({ cwd, config }) => [
    resolveProjectPath(cwd, config.componentsFsPath),
    resolveProjectPath(cwd, config.hooksFsPath),
    resolveProjectPath(cwd, config.libFsPath),
    resolveProjectPath(cwd, config.stylesFsPath),
  ],
  updateManifest: ({ cwd, removedNames }) => {
    // Items whose drifted chunk was preserved stay tracked (trimmed to chunk
    // tracking, see retainCssChunkTrackingOnly) so the block stays targetable.
    const preservedByPublicName = new Map(
      [...removeWorkflow.retainedChunkHashesByName].map(([name, hashes]) => [
        toPublicName(name),
        hashes,
      ]),
    );
    const retained = new Set(preservedByPublicName.keys());
    const names = removedNames.map(toPublicName).filter((name) => !retained.has(name));
    ctx.config.updateManifest(cwd, undefined, names);
    retainCssChunkTrackingOnly(cwd, preservedByPublicName);
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
  onAfterRemove: ({ cwd, config, removedNames, force }) => {
    const plan = planOwnedCssChunkRemoval(
      cwd,
      config,
      removedNames,
      removeWorkflow.preRemovalChunksByItem,
      force,
    );
    removeWorkflow.retainDriftedChunkHashes(plan.retainedChunkHashesByName);
    return {
      writes: plan.writes,
      preservedNotices: plan.preservedNotices,
      retainedNames: plan.retainedNames,
    };
  },
});
