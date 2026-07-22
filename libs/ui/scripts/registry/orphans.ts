import { existsSync, lstatSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { normalizeRegistryPath, type RegistryItem } from "./fs.js";

const PRODUCTION_ROOTS = ["registry/ui", "registry/hooks", "registry/lib"] as const;
const EXCLUDED_DIRECTORIES = new Set([
  "__tests__",
  "test",
  "tests",
  "stories",
  "testing",
  "example",
  "examples",
]);
// Test-only files never ship, so they are not registry items: `.test`/`.spec`/`.story`
// suites, plus colocated test-support helpers whose marker may be dot- or hyphen-joined
// (popover-test-utils.ts, select.test-utils.tsx).
const EXCLUDED_FILE_RE =
  /(?:\.(?:test|spec|story|stories|example|examples)|[.-]test-(?:utils|helpers|harness|support))\.[cm]?[jt]sx?$/;

function listProductionFiles(root: string): string[] {
  const files: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (!EXCLUDED_FILE_RE.test(entry.name)) files.push(entryPath);
    }
  }

  for (const productionRoot of PRODUCTION_ROOTS) {
    const absoluteRoot = resolve(root, productionRoot);
    if (!existsSync(absoluteRoot)) continue;
    const rootStats = lstatSync(absoluteRoot);
    if (!rootStats.isSymbolicLink() && rootStats.isDirectory()) walk(absoluteRoot);
  }

  return files;
}

export function validateOrphanFiles(root: string, items: RegistryItem[]): string[] {
  const errors: string[] = [];

  const declaredFiles = new Set<string>();

  for (const item of items) {
    for (const file of item.files ?? []) {
      const normalized = normalizeRegistryPath(file.path);
      declaredFiles.add(normalized);
    }
  }

  for (const entryPath of listProductionFiles(root).sort()) {
    const registryPath = normalizeRegistryPath(relative(root, entryPath));
    if (!declaredFiles.has(registryPath)) {
      errors.push(
        `File ${registryPath} exists on disk but is not declared in any registry item's files[]`,
      );
    }
  }

  return errors;
}
