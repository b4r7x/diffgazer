import { ctx, type ManifestItem } from "../../context.js";
import { getKeysHookNames, resolveKeysHooksFromRegistry } from "../../utils/keys-copy-bundle.js";
import { getNamespacedItem, parseInstallName } from "../../utils/namespaces.js";

type Manifest = Record<string, ManifestItem>;

function hasCopyModeFiles(record: ManifestItem): boolean {
  return (
    record.integrationMode === "copy" ||
    (record.files ?? []).some((file) => file.integrationMode === "copy")
  );
}

export function loadManifest(cwd: string): Manifest {
  return ctx.config.getManifestItems(cwd) ?? {};
}

function uiRegistryDependencyNames(installedName: string): string[] {
  const parsed = parseInstallName(installedName);
  if (parsed.namespace !== "ui") return [];
  if (!ctx.registry.getItem(parsed.name)) return [];
  return ctx.registry.resolveDeps([parsed.name]).filter((n) => n !== parsed.name);
}

function dependentsOf(candidate: string, manifest: Manifest, removed: Set<string>): string[] {
  const parsed = parseInstallName(candidate);
  const dependents = new Set<string>();

  for (const installedName of Object.keys(manifest)) {
    if (removed.has(installedName) || installedName === candidate) continue;
    const installedParsed = parseInstallName(installedName);

    if (parsed.namespace === "ui" && installedParsed.namespace === "ui") {
      if (uiRegistryDependencyNames(installedName).includes(parsed.name)) {
        dependents.add(installedName);
      }
      continue;
    }

    if (parsed.namespace === "keys" && installedParsed.namespace === "ui") {
      const record = manifest[installedName];
      if (!record || !hasCopyModeFiles(record)) continue;
      const registryItem = ctx.registry.getItem(installedParsed.name);
      if (!registryItem) continue;
      if (resolveKeysHooksFromRegistry([registryItem]).includes(parsed.name)) {
        dependents.add(installedName);
      }
    }
  }

  return [...dependents];
}

export interface ExpansionPlan {
  toRemove: string[];
  blocked: Array<{ name: string; dependents: string[] }>;
}

// Cascade orphan transitives whose dependents are all being removed, then block
// explicitly-requested items that retained installed items still need.
export function expandRemoval(cwd: string, requestedNames: string[]): ExpansionPlan {
  const manifest = loadManifest(cwd);
  const requestedPublicNames = new Set(requestedNames.map((n) => parseInstallName(n).publicName));
  const removed = new Set<string>();
  const manifestAbsent = Object.keys(manifest).length === 0;

  for (const name of requestedPublicNames) {
    // With no manifest, include the requested name so downstream file resolution
    // can reconstruct paths from the registry.
    if (manifest[name] || manifestAbsent) removed.add(name);
  }

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [installedName, record] of Object.entries(manifest)) {
      if (removed.has(installedName)) continue;
      if (record.installedAs !== "transitive") continue;
      if (dependentsOf(installedName, manifest, removed).length === 0) {
        removed.add(installedName);
        progressed = true;
      }
    }
  }

  const blocked: Array<{ name: string; dependents: string[] }> = [];
  for (const name of requestedPublicNames) {
    if (!manifest[name]) continue;
    const dependents = dependentsOf(name, manifest, removed);
    if (dependents.length > 0) {
      blocked.push({ name, dependents });
      removed.delete(name);
    }
  }

  return { toRemove: [...removed], blocked };
}

export function manifestItemsForResolve(cwd: string): ReturnType<typeof getNamespacedItem>[] {
  return Object.keys(loadManifest(cwd))
    .filter((name) => name.includes("/"))
    .map(getNamespacedItem);
}
