import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRemoveCommand, findOrphanedNpmDeps, info } from "@diffgazer/registry/cli";
import { ctx, type DiffgazerAddConfig } from "../context.js";
import { resolveKeysHooksFromRegistry } from "../utils/integration.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../utils/registry.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  publicInstallNames,
  validateInstallNames,
} from "../utils/namespaces.js";
import { normalizeManifestPath, resolveInstallPath, resolveProjectPath } from "../utils/paths.js";

function sha256(content: string): string {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

function ownedFileHash(cwd: string, itemName: string, absolutePath: string): string | null {
  const parsed = parseInstallName(itemName);

  const config = ctx.config.loadConfig(cwd);
  if (!config.ok) return null;

  const manifest = config.config.installedComponents ?? {};
  const record = manifest[parsed.publicName] ?? (parsed.namespace === "ui" ? manifest[parsed.name] : undefined);
  const files = record?.files ?? [];
  const filePath = normalizeManifestPath(cwd, absolutePath);
  return files.find((file) => file.path === filePath)?.hash ?? null;
}

function isCopyModeInstall(record: NonNullable<DiffgazerAddConfig["installedComponents"]>[string]): boolean {
  return record.integrationMode === "copy"
    || (record.files ?? []).some((file) => file.integrationMode === "copy");
}

function copyModeDependentsForKey(cwd: string, hookName: string): string[] {
  const config = ctx.config.loadConfig(cwd);
  if (!config.ok) return [];

  const manifest = config.config.installedComponents ?? {};
  const dependents: string[] = [];

  for (const [installedName, record] of Object.entries(manifest)) {
    const parsed = parseInstallName(installedName);
    if (parsed.namespace !== "ui" || !isCopyModeInstall(record)) continue;

    const registryItem = ctx.registry.getItem(parsed.name);
    if (!registryItem) continue;

    if (resolveKeysHooksFromRegistry([registryItem]).includes(hookName)) {
      dependents.push(parsed.publicName);
    }
  }

  return dependents;
}

const warnedBlockedHookRemovals = new Set<string>();

function blocksRetainedCopyModeUi(cwd: string, itemName: string): boolean {
  const parsed = parseInstallName(itemName);
  if (parsed.namespace !== "keys") return false;

  const dependents = copyModeDependentsForKey(cwd, parsed.name);
  if (dependents.length === 0) return false;

  const warningKey = `${cwd}:${parsed.publicName}`;
  if (!warnedBlockedHookRemovals.has(warningKey)) {
    warnedBlockedHookRemovals.add(warningKey);
    info(
      `Keeping ${parsed.publicName}; copied hook files are still required by installed copy-mode UI: `
      + dependents.join(", "),
    );
  }

  return true;
}

export const removeCommand = createRemoveCommand({
  itemPlural: "items",
  requireConfig: ctx.items.requireConfig,
  validateNames: validateInstallNames,
  getAllItems: () => publicInstallNames()
    .filter((name) => name.includes("/"))
    .map(getNamespacedItem),
  getItemOrThrow: getNamespacedItem,
  getItemName: (item) => item.name,
  isInstalled: ({ cwd, config, item }) => {
    return isNamespacedInstalled(cwd, config, item.name);
  },
  resolveFilesForItem: ({ cwd, config, item }) =>
    item.files.map((file) => {
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      return { absolutePath: resolveInstallPath(cwd, installDir, ctx.registry.relativePath(file)) };
    }),
  canRemoveFile: ({ cwd, item, file, force }) => {
    if (blocksRetainedCopyModeUi(cwd, item.name)) return false;
    if (force) return true;
    const expectedHash = ownedFileHash(cwd, item.name, file.absolutePath);
    if (!expectedHash) return false;
    return sha256(readFileSync(file.absolutePath, "utf-8")) === expectedHash;
  },
  resolveAllowedBaseDirs: ({ cwd, config }) => [
    resolveProjectPath(cwd, config.componentsFsPath),
    resolveProjectPath(cwd, config.hooksFsPath),
    resolveProjectPath(cwd, config.libFsPath),
  ],
  updateManifest: ({ cwd, removedNames }) => {
    const names = removedNames.map((name) => parseInstallName(name).publicName);
    const legacyUiNames = removedNames
      .map(parseInstallName)
      .filter((name) => name.namespace === "ui")
      .map((name) => name.name);
    ctx.config.updateManifest(cwd, undefined, [...names, ...legacyUiNames]);
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
});
