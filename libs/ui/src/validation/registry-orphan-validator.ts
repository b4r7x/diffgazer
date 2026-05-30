import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { normalizeRegistryPath, type RegistryItem } from "./registry-validation-fs.js";

const ORPHAN_EXCLUDED_SUFFIXES = [".test.ts", ".test.tsx", ".stories.ts", ".stories.tsx"] as const;

export function validateOrphanFiles(root: string, items: RegistryItem[]): string[] {
  const errors: string[] = [];

  const declaredFiles = new Set<string>();
  const scanDirs = new Set<string>();

  for (const item of items) {
    for (const file of item.files ?? []) {
      const normalized = normalizeRegistryPath(file.path);
      declaredFiles.add(normalized);
      scanDirs.add(dirname(normalized));
    }
  }

  for (const dir of [...scanDirs].sort()) {
    const absoluteDir = resolve(root, dir);
    if (!existsSync(absoluteDir) || !statSync(absoluteDir).isDirectory()) continue;

    for (const entry of readdirSync(absoluteDir)) {
      const entryPath = resolve(absoluteDir, entry);
      if (!statSync(entryPath).isFile()) continue;
      if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
      if (ORPHAN_EXCLUDED_SUFFIXES.some((suffix) => entry.endsWith(suffix))) continue;

      const registryPath = normalizeRegistryPath(relative(root, entryPath));
      if (!declaredFiles.has(registryPath)) {
        errors.push(`File ${registryPath} exists on disk but is not declared in any registry item's files[]`);
      }
    }
  }

  return errors;
}
