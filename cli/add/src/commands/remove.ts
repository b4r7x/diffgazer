import { readFileSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import { createRemoveCommand, findOrphanedNpmDeps } from "@diffgazer/registry/cli";
import { ctx, type ResolvedConfig } from "../context.js";
import { getKeysHookNames, resolveKeysCopyHookFiles } from "../utils/keys-copy-bundle.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  validateInstallableNames,
} from "../utils/namespaces.js";
import { normalizeManifestPath, resolveInstallPath, resolveProjectPath } from "../utils/paths.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../utils/registry.js";
import {
  createRemoveWorkflowContext,
  planOwnedCssChunkRemoval,
  readPreRemovalChunks,
  retainCssChunkTrackingOnly,
} from "./remove/css.js";
import { expandRemoval, loadManifest, manifestItemsForResolve } from "./remove/dependencies.js";

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
    const publicName = toPublicName(item.name);
    const retiredFiles = (loadManifest(cwd)[publicName]?.files ?? [])
      .filter((file) => file.retired)
      .map((file) => ({ absolutePath: resolveProjectPath(cwd, file.path) }));
    const keyName = resolveKeyName(item.name);
    if (keyName) {
      const { files, missingHooks } = resolveKeysCopyHookFiles([keyName]);
      if (missingHooks.length > 0) {
        throw new Error(`Missing bundled keys hook(s): ${missingHooks.join(", ")}`);
      }
      return [
        ...files.map((file) => ({
          absolutePath: resolveInstallPath(cwd, config.hooksFsPath, file.relativePath),
        })),
        ...retiredFiles,
      ];
    }

    const currentFiles = item.files.map((file) => {
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      return { absolutePath: resolveInstallPath(cwd, installDir, ctx.registry.relativePath(file)) };
    });
    const byPath = new Map(
      [...currentFiles, ...retiredFiles].map((file) => [file.absolutePath, file]),
    );
    return [...byPath.values()];
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
  resolveTransactionFiles: ({ cwd, config }) => resolveRemoveTransactionFiles(cwd, config),
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
