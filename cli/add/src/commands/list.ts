import { createListCommand } from "@diffgazer/registry/cli";
import { ctx } from "../context.js";
import { getNamespacedItem, isNamespacedInstalled, publicInstallNames } from "../utils/namespaces.js";

export const listCommand = createListCommand({
  itemPlural: "items",
  getAllItems: () => publicInstallNames().map(getNamespacedItem),
  getPublicItems: () => publicInstallNames()
    .filter((name) => name.includes("/"))
    .map(getNamespacedItem),
  requireConfig: ctx.items.requireConfig,
  createInstallChecker: (cwd, config) => (name) => isNamespacedInstalled(cwd, config, name),
  getRelativePath: ctx.registry.relativePath,
});
