import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  KEYS_REGISTRY_PREFIXES,
  extractLocalImports,
  normalizeRegistryPath,
  readSourceFile,
  resolveImportToRegistryPath,
  type RegistryItem,
} from "./registry-validation-fs.js";

function itemNamesByFile(items: RegistryItem[]): Map<string, string> {
  const namesByFile = new Map<string, string>();

  for (const item of items) {
    for (const file of item.files ?? []) {
      namesByFile.set(normalizeRegistryPath(file.path), item.name);
    }
  }

  return namesByFile;
}

function resolveRegistryDependencyClosure(item: RegistryItem, itemsByName: Map<string, RegistryItem>): Set<string> {
  const closure = new Set<string>([item.name]);
  const pending = [...(item.registryDependencies ?? [])];

  while (pending.length > 0) {
    const dependencyName = pending.pop();
    if (!dependencyName || closure.has(dependencyName)) continue;

    // Always add the dependency name to the closure (including external @diffgazer-keys/* items).
    closure.add(dependencyName);

    const dependency = itemsByName.get(dependencyName);
    if (!dependency) continue;

    pending.push(...(dependency.registryDependencies ?? []));
  }

  return closure;
}

export function validateRegistryImportClosure(root: string, items: RegistryItem[]): string[] {
  const errors: string[] = [];
  const itemsByName = new Map(items.map((item) => [item.name, item]));
  const namesByFile = itemNamesByFile(items);

  for (const item of items) {
    const closure = resolveRegistryDependencyClosure(item, itemsByName);

    for (const file of item.files ?? []) {
      const filePath = resolve(root, file.path);
      if (!existsSync(filePath) || file.path.endsWith(".css")) continue;

      for (const specifier of extractLocalImports(readSourceFile(root, file.path))) {
        const importedPath = resolveImportToRegistryPath(root, file.path, specifier);
        if (!importedPath) continue;

        const importedItemName = namesByFile.get(importedPath);
        if (importedItemName === item.name) continue;

        if (!importedItemName) {
          errors.push(
            `${item.name} imports ${specifier} from ${file.path}, which resolves to ${importedPath} but is not declared in any registry item's files[]`,
          );
          continue;
        }

        if (!closure.has(importedItemName)) {
          // A UI hook shim (e.g. use-focus-trap) that re-exports from @diffgazer/keys
          // is satisfied when the importer already depends on the matching @diffgazer-keys/* item.
          const importedItem = itemsByName.get(importedItemName);
          const shimKeysDeps = (importedItem?.registryDependencies ?? []).filter(
            (dep) => KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix)),
          );
          const satisfiedByKeys = shimKeysDeps.length > 0 && shimKeysDeps.every((dep) => closure.has(dep));

          if (!satisfiedByKeys) {
            errors.push(
              `${item.name} imports ${specifier} from ${file.path}, which resolves to registry item ${importedItemName} but is missing from registryDependencies closure`,
            );
          }
        }
      }
    }
  }

  return errors;
}
