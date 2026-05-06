import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createRemoveCommand, findOrphanedNpmDeps } from "@diffgazer/registry/cli";
import { ctx } from "../context.js";
import { getInstallBaseForFilePath, getInstallDirForBase } from "../utils/registry.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  publicInstallNames,
  validateInstallNames,
} from "../utils/namespaces.js";

function sha256(content: string): string {
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

function ownedFileHash(cwd: string, itemName: string, absolutePath: string): string | null {
  const parsed = parseInstallName(itemName);
  if (parsed.namespace !== "ui") return null;

  const config = ctx.config.loadConfig(cwd);
  if (!config.ok) return null;

  const files = config.config.installedComponents?.[parsed.name]?.files ?? [];
  const filePath = relative(cwd, absolutePath);
  return files.find((file) => file.path === filePath)?.hash ?? null;
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
      return { absolutePath: resolve(cwd, installDir, ctx.registry.relativePath(file)) };
    }),
  canRemoveFile: ({ cwd, item, file, force }) => {
    if (force) return true;
    const expectedHash = ownedFileHash(cwd, item.name, file.absolutePath);
    if (!expectedHash) return false;
    return sha256(readFileSync(file.absolutePath, "utf-8")) === expectedHash;
  },
  resolveAllowedBaseDirs: ({ cwd, config }) => [
    resolve(cwd, config.componentsFsPath),
    resolve(cwd, config.hooksFsPath),
    resolve(cwd, config.libFsPath),
  ],
  updateManifest: ({ cwd, removedNames }) => {
    const uiRemovedNames = removedNames
      .map(parseInstallName)
      .filter((name) => name.namespace === "ui")
      .map((name) => name.name);
    if (uiRemovedNames.length > 0) {
      ctx.config.updateManifest(cwd, undefined, uiRemovedNames);
    }
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
