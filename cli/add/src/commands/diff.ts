import { resolve } from "node:path";
import { createDiffCommand, ensureWithinDir } from "@diffgazer/registry/cli";
import { ctx } from "../context.js";
import {
  prepareFileContent,
  getInstallBaseForFilePath,
  getInstallDirForBase,
} from "../utils/registry.js";
import {
  getNamespacedItem,
  isNamespacedInstalled,
  parseInstallName,
  publicInstallNames,
  validateInstallNames,
} from "../utils/namespaces.js";

export const diffCommand = createDiffCommand({
  itemPlural: "items",
  requireConfig: ctx.items.requireConfig,
  resolveDefaultNames: ({ cwd, config }) => {
    const isInstalled = (name: string) => isNamespacedInstalled(cwd, config, name);
    return publicInstallNames()
      .filter((name) => name.includes("/"))
      .filter(isInstalled);
  },
  validateRequestedNames: validateInstallNames,
  resolveFilesForName: ({ name, cwd, config }) => {
    const parsed = parseInstallName(name);
    const item = getNamespacedItem(name);
    const componentsDir = resolve(cwd, config.componentsFsPath);
    const hooksDir = resolve(cwd, config.hooksFsPath);
    const libDir = resolve(cwd, config.libFsPath);

    return item.files.map((file) => {
      const relativePath = ctx.registry.relativePath(file);
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      const localPath = resolve(cwd, installDir, relativePath);
      const targetRoot = installBase === "components"
        ? componentsDir
        : installBase === "hooks"
          ? hooksDir
          : libDir;
      ensureWithinDir(localPath, targetRoot);

      return {
        itemName: `${parsed.namespace}/${parsed.name}`,
        relativePath,
        localPath,
        registryContent: prepareFileContent(file, item, config),
      };
    });
  },
  noInstalledMessage: "No installed Diffgazer items found.",
  upToDateMessage: "All Diffgazer items are up to date with registry.",
});
