const KEYS_REGISTRY_PREFIXES = ["@diffgazer/keys/", "@diffgazer-keys/"] as const;

interface DistKeyItem {
  type: string;
  name: string;
}

interface KeysHookItem {
  registryDependencies?: string[];
}

/** Maps a registry item to its dist output path (e.g. `components/button`). */
export function registryItemToDistKey(item: DistKeyItem): string {
  if (item.type === "registry:hook") return `hooks/${item.name}`;
  if (item.type === "registry:lib") return `lib/${item.name}`;
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
      for (const prefix of KEYS_REGISTRY_PREFIXES) {
        if (dep.startsWith(prefix)) {
          files.add(`use-${dep.slice(prefix.length)}`);
        }
      }
    }
  }
  return files;
}
