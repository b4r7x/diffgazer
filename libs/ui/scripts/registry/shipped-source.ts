import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { extractImportSpecifiers, listPublicRegistryEntries } from "@diffgazer/registry";
import { normalizeRegistryPath } from "./fs.js";

const TEST_SOURCE_RE =
  /\.(?:test|spec|stories?)\.[jt]sx?$|[.-]test-(?:utils|helpers|harness|support)\./;
const SHIPPED_REGISTRY_DIRS = [
  "registry/ui",
  "registry/hooks",
  "registry/lib",
  "registry/examples",
] as const;
const BUILD_ENV_TOKENS = ["process.env", "import.meta.env", "NODE_ENV"] as const;

export function sourceFilesUnder(root: string, registryDir: string): string[] {
  const directory = resolve(root, registryDir);
  if (!existsSync(directory)) return [];

  function walk(dir: string): string[] {
    const entries: string[] = [];
    for (const entry of readdirSync(dir)) {
      const entryPath = resolve(dir, entry);
      if (statSync(entryPath).isDirectory()) {
        entries.push(...walk(entryPath));
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        entries.push(entryPath);
      }
    }
    return entries;
  }

  return walk(directory);
}

/** Files a copy/dgadd consumer actually receives; test suites never ship. */
export function shippedSourceFiles(root: string, registryDir: string): string[] {
  return sourceFilesUnder(root, registryDir).filter((file) => !TEST_SOURCE_RE.test(file));
}

// Copy/dgadd consumers paste this source into their own app, where `process` is
// undeclared under the stock Vite react-ts tsconfig and no bundler define is
// guaranteed. Shipped registry source therefore reads no build environment at all;
// diagnostics are hard throws, matching the shadcn copy-paste norm.
export function validateNoBuildEnvReads(root: string): string[] {
  const errors: string[] = [];

  for (const registryDir of SHIPPED_REGISTRY_DIRS) {
    for (const sourceFile of shippedSourceFiles(root, registryDir)) {
      const source = readFileSync(sourceFile, "utf-8");
      const matched = BUILD_ENV_TOKENS.filter((token) => source.includes(token));
      if (matched.length === 0) continue;

      errors.push(
        `${normalizeRegistryPath(relative(root, sourceFile))} reads ${matched.join(", ")}; shipped registry source must not depend on a build environment`,
      );
    }
  }

  return errors;
}

export function validateNoPublicKeysImports(root: string): string[] {
  const errors: string[] = [];
  const registryDir = resolve(root, "public/r");
  if (!existsSync(registryDir)) return errors;

  for (const { entry, itemPath } of listPublicRegistryEntries(registryDir)) {
    let data: { files?: { content?: string; path?: string }[] };
    try {
      data = JSON.parse(readFileSync(itemPath, "utf-8"));
    } catch (err) {
      errors.push(`Public registry item "${entry}" is not valid JSON: ${(err as Error).message}`);
      continue;
    }

    for (const file of data.files ?? []) {
      if (typeof file.content !== "string") continue;
      const residual = extractImportSpecifiers(file.content).filter(
        ({ specifier }) => specifier === "@diffgazer/keys",
      );
      if (residual.length > 0) {
        const forms = [...new Set(residual.map(({ kind }) => kind))].join(", ");
        errors.push(
          `Public registry item "${entry}" file "${file.path ?? "(unknown)"}" contains unsupported @diffgazer/keys root import (${forms}); public copy source must use rewritten local hooks`,
        );
      }
    }
  }

  return errors;
}
