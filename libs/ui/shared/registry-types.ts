export interface RegistryFile {
  path: string;
  type: string;
}

export interface RegistryItem {
  name: string;
  type: string;
  files: RegistryFile[];
  registryDependencies?: string[];
  meta?: {
    client?: boolean;
  };
}

export interface Registry {
  items: RegistryItem[];
}

/**
 * Extract @diffgazer keys hook names from registry item dependency refs.
 * Returns raw names (e.g., "navigation", "focus-trap") without `use-` prefix.
 */
export function extractDiffgazerKeysHookNames(items: Pick<RegistryItem, "registryDependencies">[]): Set<string> {
  const names = new Set<string>();
  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("@diffgazer/keys/")) {
        names.add(dep.replace("@diffgazer/keys/", ""));
      } else if (dep.startsWith("@diffgazer-keys/")) {
        names.add(dep.replace("@diffgazer-keys/", ""));
      }
    }
  }
  return names;
}
