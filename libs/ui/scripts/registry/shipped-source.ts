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

/**
 * Comment bodies and literal text are dropped so source that merely *mentions* a
 * pattern (a code-block example embedding a JSX sample string, a comment naming
 * `process.env`) never reads as real code to the scanners below. Template
 * interpolations are kept: `${…}` is executed code, not text.
 */
export function stripLiteralsAndComments(source: string): string {
  let code = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const pair = source.slice(index, index + 2);

    if (pair === "//") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
    } else if (pair === "/*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    } else if (char === "`") {
      index += 1;
      while (index < source.length && source[index] !== "`") {
        if (source[index] === "\\") {
          index += 2;
        } else if (source.slice(index, index + 2) === "${") {
          index += 2;
          let depth = 1;
          while (index < source.length && depth > 0) {
            if (source[index] === "{") depth += 1;
            else if (source[index] === "}") depth -= 1;
            if (depth > 0) code += source[index];
            index += 1;
          }
          code += " ";
        } else {
          index += 1;
        }
      }
      index += 1;
    } else if (char === '"' || char === "'") {
      index += 1;
      while (index < source.length && source[index] !== char) {
        index += source[index] === "\\" ? 2 : 1;
      }
      index += 1;
    } else {
      code += char;
      index += 1;
    }
  }

  return code;
}

// Copy/dgadd consumers paste this source into their own app, where `process` is
// undeclared under the stock Vite react-ts tsconfig and no bundler define is
// guaranteed. Shipped registry source therefore reads no build environment at all;
// diagnostics are hard throws, matching the shadcn copy-paste norm.
export function validateNoBuildEnvReads(root: string): string[] {
  const errors: string[] = [];

  for (const registryDir of SHIPPED_REGISTRY_DIRS) {
    for (const sourceFile of shippedSourceFiles(root, registryDir)) {
      const source = stripLiteralsAndComments(readFileSync(sourceFile, "utf-8"));
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
