import { createDiffCommand } from "@diffgazer/registry/cli";
import { ctx, type DiffgazerAddConfig } from "../context.js";
import { rewriteLocalImportsForKeysPackage } from "../utils/transform.js";
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
import { resolveInstallPath } from "../utils/paths.js";

type InstalledComponents = NonNullable<DiffgazerAddConfig["installedComponents"]>;
type IntegrationMode = NonNullable<InstalledComponents[string]>["integrationMode"];

function resolveIntegrationMode(cwd: string, itemName: string, manifestPath: string): IntegrationMode {
  const manifest = ctx.config.getManifestItems(cwd) as InstalledComponents | undefined;
  const entry = manifest?.[itemName];
  const fileEntry = entry?.files?.find((file) => file.path === manifestPath);
  return fileEntry?.integrationMode ?? entry?.integrationMode;
}

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
    return item.files.map((file) => {
      const relativePath = ctx.registry.relativePath(file);
      const installBase = getInstallBaseForFilePath(file.path);
      const installDir = getInstallDirForBase(installBase, config);
      const localPath = resolveInstallPath(cwd, installDir, relativePath);
      const itemName = `${parsed.namespace}/${parsed.name}`;
      const manifestPath = `${installDir}/${relativePath}`.replace(/\\/g, "/");
      const rawContent = resolveIntegrationMode(cwd, itemName, manifestPath) === "@diffgazer/keys"
        ? rewriteLocalImportsForKeysPackage(file.content)
        : file.content;

      return {
        itemName,
        relativePath,
        localPath,
        registryContent: prepareFileContent({ ...file, content: rawContent }, item, config),
      };
    });
  },
  noInstalledMessage: "No installed Diffgazer items found.",
  upToDateMessage: "All Diffgazer items are up to date with registry.",
});
