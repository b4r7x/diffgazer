import type { ConfigLoadResult } from "./config.js";
import type { RegistryItem } from "./registry.js";
import { createRequireConfig } from "./require-config.js";

function getItemOrThrow<T extends RegistryItem>(
  name: string,
  getItem: (name: string) => T | undefined,
  itemLabel: string,
  listCommand: string,
): T {
  const item = getItem(name);
  if (!item) {
    throw new Error(
      `${itemLabel} "${name}" not found in registry. Run \`${listCommand}\` to see available ${itemLabel.toLowerCase()}s.`,
    );
  }
  return item;
}

export interface CreateItemAccessorsOptions<TConfig, TItem extends RegistryItem = RegistryItem> {
  configFileName: string;
  initCommand: string;
  itemLabel: string;
  listCommand: string;
  loadResolved: (cwd: string) => ConfigLoadResult<TConfig>;
  getItem: (name: string) => TItem | undefined;
}

export function createItemAccessors<TConfig, TItem extends RegistryItem = RegistryItem>(
  options: CreateItemAccessorsOptions<TConfig, TItem>,
) {
  const requireConfig = createRequireConfig({
    configFileName: options.configFileName,
    initCommand: options.initCommand,
    loadResolved: options.loadResolved,
  });

  function getOrThrow(name: string): TItem {
    return getItemOrThrow(name, options.getItem, options.itemLabel, options.listCommand);
  }

  return { requireConfig, getOrThrow };
}
