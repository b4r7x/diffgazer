import { readFileSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import { createRemoveCommand, findOrphanedNpmDeps } from "@diffgazer/registry/cli";
import {
  ctx,
  type DiffgazerAddConfig,
  type ManifestItem,
  type ResolvedConfig,
  resolveConfig,
} from "../../context.js";
import { getKeysHookNames, resolveKeysCopyHookFiles } from "../../utils/keys-copy-bundle.js";
import { withProjectMutationLock } from "../../utils/mutation-lock.js";
import {
  isNamespacedInstalled,
  parseInstallName,
  resolveNamespacedItem,
  tryGetNamespacedItem,
  validateInstalledOrRegistryNames,
} from "../../utils/namespaces.js";
import {
  normalizeManifestPath,
  resolveInstallPath,
  resolveProjectPath,
} from "../../utils/paths.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../../utils/registry.js";
import {
  applyRemovalManifestUpdate,
  planOwnedCssChunkRemoval,
  readPreRemovalChunks,
} from "./css.js";
import { expandRemoval, manifestItemsForResolve } from "./dependencies.js";

interface RemoveRemovalMetadata {
  retainedChunkHashesByName: Map<string, string[]>;
}

interface RemoveCommandState {
  capturedConfig: DiffgazerAddConfig;
  configSnapshot: string;
  resolvedConfig: ResolvedConfig;
  manifest: Record<string, ManifestItem>;
  uiChecker: ReturnType<typeof ctx.createChecker>;
  preRemovalChunksByItem: Map<string, string[]>;
}

function compareSnapshotKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function serializeConfigSnapshot(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeConfigSnapshot).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      compareSnapshotKeys(left, right),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${serializeConfigSnapshot(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function createRemoveCommandState(cwd: string): RemoveCommandState {
  const loaded = ctx.config.loadConfigWithRaw(cwd);
  if (!loaded.ok) {
    ctx.items.requireConfig(cwd);
    throw new Error("Could not load diffgazer.json.");
  }
  const resolvedConfig = resolveConfig(loaded.config, cwd);
  const manifest = loaded.config.installedItems ?? {};
  return {
    // Rewritten from the parsed file, not the validated config, so unknown nested
    // config content survives the removal write untouched.
    capturedConfig: loaded.raw as DiffgazerAddConfig,
    // The lock compares this against a re-read of the file, so it snapshots the
    // file exactly as it is on disk.
    configSnapshot: serializeConfigSnapshot(loaded.raw),
    resolvedConfig,
    manifest,
    uiChecker: ctx.createChecker(cwd, resolvedConfig.componentsFsPath),
    preRemovalChunksByItem: readPreRemovalChunks(manifest),
  };
}

function ownedFileHash(
  manifest: Record<string, ManifestItem>,
  cwd: string,
  itemName: string,
  absolutePath: string,
): string | null {
  const parsed = parseInstallName(itemName);
  const record = manifest[parsed.publicName];
  const files = record?.files ?? [];
  const filePath = normalizeManifestPath(cwd, absolutePath);
  return files.find((file) => file.path === filePath)?.hash ?? null;
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

export function resolveRemoveTransactionFiles(cwd: string, config: ResolvedConfig): string[] {
  const paths = [resolveProjectPath(cwd, "diffgazer.json")];
  if (config.tailwind?.css) paths.push(resolveProjectPath(cwd, config.tailwind.css));
  return paths;
}

export const removeCommand = createRemoveCommand<
  ReturnType<typeof resolveNamespacedItem>,
  RemoveCommandState,
  RemoveRemovalMetadata
>({
  itemPlural: "items",
  withLock: withProjectMutationLock,
  requireConfig: createRemoveCommandState,
  validateNames: (names, { cwd, config }) =>
    validateInstalledOrRegistryNames(cwd, names, config.manifest),
  getAllItems: ({ cwd, config }) => manifestItemsForResolve(config.manifest, cwd),
  getItemOrThrow: (name, { cwd, config }) => resolveNamespacedItem(name, cwd, config.manifest),
  getItemName: (item) => item.name,
  isInstalled: ({ cwd, config, item }) =>
    isNamespacedInstalled(cwd, config.resolvedConfig, item.name, config.manifest, config.uiChecker),
  resolveFilesForItem: ({ cwd, config, item }) => {
    const publicName = toPublicName(item.name);
    const manifestOwnedFiles = (config.manifest[publicName]?.files ?? []).map((file) => ({
      absolutePath: resolveProjectPath(cwd, file.path),
    }));
    const keyName = resolveKeyName(item.name);
    if (keyName && tryGetNamespacedItem(item.name)) {
      const { files, missingHooks } = resolveKeysCopyHookFiles([keyName]);
      if (missingHooks.length > 0) {
        throw new Error(`Missing bundled keys hook(s): ${missingHooks.join(", ")}`);
      }
      return [
        ...files.map((file) => ({
          absolutePath: resolveInstallPath(
            cwd,
            config.resolvedConfig.hooksFsPath,
            file.relativePath,
          ),
        })),
        ...manifestOwnedFiles,
      ];
    }

    // `.css` registry files are merged into styles.css as tracked chunks and
    // never written as standalone files, so only planOwnedCssChunkRemoval owns them.
    const currentFiles = item.files
      .filter((file) => !file.path.endsWith(".css"))
      .map((file) => {
        const installBase = getInstallBaseForFilePath(file.path);
        const installDir = getInstallDirForBase(installBase, config.resolvedConfig);
        return {
          absolutePath: resolveInstallPath(cwd, installDir, ctx.registry.relativePath(file)),
        };
      });
    const byPath = new Map(
      [...currentFiles, ...manifestOwnedFiles].map((file) => [file.absolutePath, file]),
    );
    return [...byPath.values()];
  },
  checkFileRemoval: ({ cwd, config, item, file, force }) => {
    if (force) return "removable";
    const expectedHash = ownedFileHash(config.manifest, cwd, item.name, file.absolutePath);
    if (!expectedHash) return "unowned";
    const matches = computeIntegrity(readFileSync(file.absolutePath, "utf-8")) === expectedHash;
    return matches ? "removable" : "modified";
  },
  resolveAllowedBaseDirs: ({ cwd, config: { resolvedConfig } }) => [
    resolveProjectPath(cwd, resolvedConfig.componentsFsPath),
    resolveProjectPath(cwd, resolvedConfig.hooksFsPath),
    resolveProjectPath(cwd, resolvedConfig.libFsPath),
    resolveProjectPath(cwd, resolvedConfig.stylesFsPath),
  ],
  resolveTransactionFiles: ({ cwd, config }) =>
    resolveRemoveTransactionFiles(cwd, config.resolvedConfig),
  validateTransaction: ({ cwd, config }) => {
    let currentSnapshot: string;
    try {
      currentSnapshot = serializeConfigSnapshot(
        JSON.parse(readFileSync(resolveProjectPath(cwd, "diffgazer.json"), "utf-8")),
      );
    } catch {
      throw new Error("Cannot remove items: diffgazer.json changed during confirmation.");
    }
    if (currentSnapshot !== config.configSnapshot) {
      throw new Error("Cannot remove items: diffgazer.json changed during confirmation.");
    }
  },
  updateManifest: ({ cwd, config, removedNames, metadata }) => {
    // Items whose drifted chunk was preserved stay tracked (trimmed to chunk
    // tracking) so the block stays targetable.
    const preservedByPublicName = new Map(
      [...(metadata?.retainedChunkHashesByName ?? new Map())].map(([name, hashes]) => [
        toPublicName(name),
        hashes,
      ]),
    );
    const retained = new Set(preservedByPublicName.keys());
    const names = removedNames.map(toPublicName).filter((name) => !retained.has(name));
    applyRemovalManifestUpdate(cwd, config.capturedConfig, names, preservedByPublicName);
  },
  findOrphanedDeps: ({ removedNames, config }) => {
    const removedUiNames = removedNames
      .map(parseInstallName)
      .filter((name) => name.namespace === "ui")
      .map((name) => name.name);
    return findOrphanedNpmDeps({
      removedNames: removedUiNames,
      getAllItems: ctx.registry.getAllItems,
      getItemName: (c) => c.name,
      getItemDeps: (c) => c.dependencies,
      isInstalled: (c) => config.uiChecker(c.name),
    });
  },
  expandRequestedNames: ({ config, names }) => expandRemoval(config.manifest, names),
  onAfterRemove: ({ cwd, config, removedNames, force }) => {
    const plan = planOwnedCssChunkRemoval(
      cwd,
      config.resolvedConfig,
      removedNames,
      config.preRemovalChunksByItem,
      force,
    );
    return {
      writes: plan.writes,
      preservedNotices: plan.preservedNotices,
      retainedNames: [...plan.retainedChunkHashesByName.keys()],
      metadata: { retainedChunkHashesByName: plan.retainedChunkHashesByName },
    };
  },
});
