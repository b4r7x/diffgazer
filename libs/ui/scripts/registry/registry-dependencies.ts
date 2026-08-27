import { REGISTRY_ORIGIN } from "@diffgazer/registry";
import { parseKeysDependencyRef } from "@diffgazer/registry/schemas";
import type { PublicRegistryItemJson } from "./public-registry-json.js";

function toDirectRegistryDependency(dep: string): string {
  if (dep.startsWith("http://") || dep.startsWith("https://")) return dep;
  const keysHook = parseKeysDependencyRef(dep);
  if (keysHook) return `${REGISTRY_ORIGIN}/r/keys/${keysHook}.json`;
  if (dep.startsWith("@")) return dep;
  return `${REGISTRY_ORIGIN}/r/ui/${dep}.json`;
}

export function transformUiPublicRegistryItem<T extends { registryDependencies?: string[] }>(
  item: T,
): T {
  if (!Array.isArray(item.registryDependencies)) return item;

  return {
    ...item,
    registryDependencies: item.registryDependencies.map(toDirectRegistryDependency),
  };
}

export function transformRegistryDependencies(item: PublicRegistryItemJson): boolean {
  const next = transformUiPublicRegistryItem(item);
  if (next.registryDependencies === item.registryDependencies) return false;

  item.registryDependencies = next.registryDependencies;
  return true;
}
