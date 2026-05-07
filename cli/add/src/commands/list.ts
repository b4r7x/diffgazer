import { createListCommand } from "@diffgazer/registry/cli";
import { ctx } from "../context.js";
import { allListNames, getNamespacedItem, isNamespacedInstalled, publicListNames } from "../utils/namespaces.js";

export const listCommand = createListCommand({
  itemPlural: "items",
  getAllItems: () => allListNames().map(getNamespacedItem),
  getPublicItems: () => publicListNames().map(getNamespacedItem),
  requireConfig: ctx.items.requireConfig,
  createInstallChecker: (cwd, config) => (name) => isNamespacedInstalled(cwd, config, name),
  getRelativePath: ctx.registry.relativePath,
});
