import { parseKeysDependencyRef, REGISTRY_ITEM_TYPE } from "../registry-types.js";

interface DistKeyItem {
  type: string;
  name: string;
}

interface KeysHookItem {
  registryDependencies?: string[];
}

/** Maps a registry item to its dist output path (e.g. `components/button`). */
export function registryItemToDistKey(item: DistKeyItem): string {
  if (item.type === REGISTRY_ITEM_TYPE.hook) return `hooks/${item.name}`;
  if (item.type === REGISTRY_ITEM_TYPE.lib) return `lib/${item.name}`;
  return `components/${item.name}`;
}

/**
 * Resolves the `use-`prefixed hook filenames that map to the published
 * `@diffgazer/keys` package, derived from registry items' dependency refs.
 */
export function resolveKeysHookFiles(items: KeysHookItem[]): Set<string> {
  const files = new Set<string>();
  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      const hook = parseKeysDependencyRef(dep);
      if (hook) files.add(`use-${hook}`);
    }
  }
  return files;
}
