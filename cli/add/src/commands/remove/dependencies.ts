import { ctx, type ManifestItem } from "../../context.js";
import { resolveKeysHooksFromRegistry } from "../../utils/keys-copy-bundle.js";
import {
  type getNamespacedItem,
  parseInstallName,
  resolveNamespacedItem,
} from "../../utils/namespaces.js";

type Manifest = Record<string, ManifestItem>;
type RemoveDependencyGraph = ReadonlyMap<string, readonly string[]>;

function hasCopyModeFiles(record: ManifestItem): boolean {
  return (
    record.integrationMode === "copy" ||
    (record.files ?? []).some((file) => file.integrationMode === "copy")
  );
}

export function loadManifest(cwd: string): Manifest {
  return ctx.config.getManifestItems(cwd) ?? {};
}

function manifestHasPersistedRequires(manifest: Manifest): boolean {
  return Object.values(manifest).some((record) => record.requires !== undefined);
}

function canAutoCascadeTransitives(manifest: Manifest): boolean {
  // A manifest with no persisted edges cannot distinguish an orphan from an
  // older installation that still needs it. Once at least one install-time
  // edge exists, legacy records are checked against the live registry below.
  return manifestHasPersistedRequires(manifest);
}

function uiRegistryDependencyNames(installedName: string): string[] {
  const parsed = parseInstallName(installedName);
  if (parsed.namespace !== "ui") return [];
  if (!ctx.registry.getItem(parsed.name)) return [];
  return ctx.registry.resolveDeps([parsed.name]).filter((n) => n !== parsed.name);
}

function keysHookDependencyPublicNames(parentInstalledName: string, manifest: Manifest): string[] {
  const parsed = parseInstallName(parentInstalledName);
  if (parsed.namespace !== "ui") return [];
  const record = manifest[parentInstalledName];
  if (!record || !hasCopyModeFiles(record)) return [];
  const registryItem = ctx.registry.getItem(parsed.name);
  if (!registryItem) return [];
  return resolveKeysHooksFromRegistry([registryItem]).map((name) => `keys/${name}`);
}

function dependencyPublicNamesOf(parentInstalledName: string, manifest: Manifest): string[] {
  const record = manifest[parentInstalledName];
  if (!record) return [];

  // `requires: []` is an explicit install-time assertion. Do not supplement
  // it with the live registry: the installed record is the source of truth
  // after a registry update. Only legacy records without the field fall back
  // to the current bundle.
  if (record.requires !== undefined) return [...record.requires];

  const deps = new Set<string>();
  for (const name of uiRegistryDependencyNames(parentInstalledName)) {
    deps.add(`ui/${name}`);
  }
  for (const name of keysHookDependencyPublicNames(parentInstalledName, manifest)) {
    deps.add(name);
  }
  return [...deps];
}

function isTransitiveDependencyOf(
  candidate: string,
  dependencyGraph: RemoveDependencyGraph,
  removed: Set<string>,
): boolean {
  for (const parentName of removed) {
    if (dependencyGraph.get(parentName)?.includes(candidate)) return true;
  }
  return false;
}

function dependentsOf(
  candidate: string,
  dependencyGraph: RemoveDependencyGraph,
  removed: Set<string>,
): string[] {
  const dependents = new Set<string>();
  for (const [installedName, dependencies] of dependencyGraph) {
    if (removed.has(installedName) || installedName === candidate) continue;
    if (dependencies.includes(candidate)) dependents.add(installedName);
  }
  return [...dependents];
}

function createDependencyGraph(manifest: Manifest): RemoveDependencyGraph {
  const graph = new Map<string, readonly string[]>();
  for (const installedName of Object.keys(manifest)) {
    graph.set(installedName, dependencyPublicNamesOf(installedName, manifest));
  }
  return graph;
}

export interface ExpansionPlan {
  toRemove: string[];
  blocked: Array<{ name: string; dependents: string[] }>;
  dependencyGraph: RemoveDependencyGraph;
}

function retractDependenciesOfRetainedItems(
  manifest: Manifest,
  removed: Set<string>,
  dependencyGraph: RemoveDependencyGraph,
): boolean {
  const retained = new Set(Object.keys(manifest).filter((name) => !removed.has(name)));
  let changed = false;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const parent of retained) {
      for (const dependency of dependencyGraph.get(parent) ?? []) {
        if (!removed.delete(dependency)) continue;
        retained.add(dependency);
        progressed = true;
        changed = true;
      }
    }
  }
  return changed;
}

function stabilizeBlockedRequests(
  manifest: Manifest,
  requestedNames: string[],
  removed: Set<string>,
  dependencyGraph: RemoveDependencyGraph,
): void {
  // Blocking a requested owner can retain a dependency that was provisionally
  // cascaded. That newly-retained dependency can itself block another request,
  // so alternate blocking and retraction until neither set changes.
  let progressed = true;
  while (progressed) {
    progressed = false;

    for (const name of requestedNames) {
      if (!manifest[name] || !removed.has(name)) continue;
      if (dependentsOf(name, dependencyGraph, removed).length === 0) continue;
      removed.delete(name);
      progressed = true;
    }

    if (retractDependenciesOfRetainedItems(manifest, removed, dependencyGraph)) progressed = true;
  }
}

function publicNameNamespaceRank(name: string): number {
  if (name.startsWith("ui/")) return 0;
  if (name.startsWith("keys/")) return 1;
  return 2;
}

function orderNames(names: Iterable<string>, manifest: Manifest): string[] {
  const manifestOrder = new Map(Object.keys(manifest).map((name, index) => [name, index]));
  return [...new Set(names)].sort((left, right) => {
    const leftManifestIndex = manifestOrder.get(left);
    const rightManifestIndex = manifestOrder.get(right);
    if (leftManifestIndex !== undefined && rightManifestIndex !== undefined) {
      return leftManifestIndex - rightManifestIndex;
    }
    if (leftManifestIndex !== undefined) return -1;
    if (rightManifestIndex !== undefined) return 1;
    const leftNamespaceRank = publicNameNamespaceRank(left);
    const rightNamespaceRank = publicNameNamespaceRank(right);
    if (leftNamespaceRank !== rightNamespaceRank) return leftNamespaceRank - rightNamespaceRank;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
}

// Cascade orphan transitives whose dependents are all being removed, then block
// explicitly-requested items that retained installed items still need.
export function expandRemoval(manifest: Manifest, requestedNames: string[]): ExpansionPlan {
  const dependencyGraph = createDependencyGraph(manifest);
  const requestedPublicNames = new Set(requestedNames.map((n) => parseInstallName(n).publicName));
  const removed = new Set<string>();

  for (const name of requestedPublicNames) {
    removed.add(name);
  }

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [installedName, record] of Object.entries(manifest)) {
      if (removed.has(installedName)) continue;
      if (record.installedAs !== "transitive") continue;
      if (
        canAutoCascadeTransitives(manifest) &&
        isTransitiveDependencyOf(installedName, dependencyGraph, removed) &&
        dependentsOf(installedName, dependencyGraph, removed).length === 0
      ) {
        removed.add(installedName);
        progressed = true;
      }
    }
  }

  const requestedOrder = [...requestedPublicNames];
  stabilizeBlockedRequests(manifest, requestedOrder, removed, dependencyGraph);

  const blocked = orderNames(requestedOrder, manifest)
    .filter((name) => manifest[name] && !removed.has(name))
    .map((name) => ({ name, dependents: dependentsOf(name, dependencyGraph, removed) }))
    .filter(({ dependents }) => dependents.length > 0);

  return { toRemove: orderNames(removed, manifest), blocked, dependencyGraph };
}

export function manifestItemsForResolve(
  manifest: Manifest,
  cwd: string,
): ReturnType<typeof getNamespacedItem>[] {
  return Object.keys(manifest)
    .filter((name) => name.includes("/"))
    .map((name) => resolveNamespacedItem(name, cwd, manifest));
}
