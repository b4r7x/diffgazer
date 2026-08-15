import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { hasUseClientDirective } from "@diffgazer/registry/build-checks";
import type { Registry } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import { extractRelativeImports, type ValidationError, validationError } from "./types.js";

const BUILD_ENV_TOKENS = ["process.env", "import.meta.env", "NODE_ENV"] as const;

function isExistingFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Copy/dgadd consumers paste this source into their own app, where `process` is
 * undeclared under the stock Vite react-ts tsconfig and no bundler define is
 * guaranteed. Shipped registry source therefore reads no build environment at all;
 * diagnostics are hard throws, matching the shadcn copy-paste norm.
 *
 * `item.files` is the full transitive closure: {@link validateImportClosure} rejects
 * any relative import that resolves outside it, so scanning the declared files scans
 * everything a consumer receives.
 */
export function validateNoBuildEnvReads(
  registry: Registry,
  registryRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    for (const file of item.files) {
      const filePath = resolve(registryRoot, file.path);
      // A missing file is already reported by validateImportClosure.
      if (!isExistingFile(filePath)) continue;

      const source = readFileSync(filePath, "utf-8");
      const matched = BUILD_ENV_TOKENS.filter((token) => source.includes(token));
      if (matched.length === 0) continue;

      errors.push(
        validationError(
          "REGISTRY_BUILD_ENV_READ",
          item.name,
          `${file.path} reads ${matched.join(", ")}; shipped registry source must not depend on a build environment`,
        ),
      );
    }
  }

  return errors;
}

/**
 * The registry metadata is the source of truth for the RSC boundary exposed by
 * copy consumers. A client item must carry the directive in the source it
 * publishes; otherwise the metadata promises a boundary that a pasted module
 * does not actually provide.
 */
export function validateClientMetadata(
  registry: Registry,
  registryRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    if (item.meta?.client !== true) continue;

    const hasClientDirective = item.files.some((file) => {
      const filePath = resolve(registryRoot, file.path);
      return isExistingFile(filePath) && hasUseClientDirective(readFileSync(filePath, "utf-8"));
    });

    if (!hasClientDirective) {
      errors.push(
        validationError(
          "REGISTRY_CLIENT_METADATA",
          item.name,
          'Item declares meta.client but no source file starts with "use client"',
        ),
      );
    }
  }

  return errors;
}

export function validateImportClosure(registry: Registry, registryRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    const includedFiles = new Set(item.files.map((f) => f.path));

    for (const file of item.files) {
      const filePath = resolve(registryRoot, file.path);
      if (!isExistingFile(filePath)) {
        errors.push(
          validationError(
            "REGISTRY_IMPORT_CLOSURE",
            item.name,
            `Source file not found: ${file.path}`,
          ),
        );
        continue;
      }

      const content = readFileSync(filePath, "utf-8");

      for (const importPathRaw of extractRelativeImports(content)) {
        let importPath = importPathRaw;

        const hasJsExtension = importPath.endsWith(".js");
        if (hasJsExtension) {
          importPath = importPath.slice(0, -3);
        }

        const baseDir = resolve(registryRoot, file.path, "..");
        const resolvedPath = resolve(baseDir, importPath);

        // Prefer extensioned / index files before the bare path so a sibling
        // directory (e.g. use-navigation/) cannot shadow use-navigation.ts.
        const tryPaths = [
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.tsx`,
          resolvedPath,
        ];

        let found = false;
        let foundRelativePath = "";

        for (const tryPath of tryPaths) {
          if (isExistingFile(tryPath)) {
            found = true;
            foundRelativePath = resolve(tryPath).slice(resolve(registryRoot).length + 1);
            foundRelativePath = foundRelativePath.replace(/\\/g, "/");
            break;
          }
        }

        if (!found) {
          errors.push(
            validationError(
              "REGISTRY_IMPORT_CLOSURE",
              item.name,
              `Cannot resolve import "${importPathRaw}" from ${file.path}`,
            ),
          );
          continue;
        }

        if (!includedFiles.has(foundRelativePath)) {
          errors.push(
            validationError(
              "REGISTRY_IMPORT_CLOSURE",
              item.name,
              `Missing transitive import in registry: ${importPathRaw} (resolves to ${foundRelativePath})`,
            ),
          );
        }
      }
    }
  }

  return errors;
}

export function validateRegistryStructure(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    // libs/keys ships hooks only. The other validators run over every item, so an
    // unexpected type is rejected here instead of silently skipping its checks.
    if (item.type !== REGISTRY_ITEM_TYPE.hook) {
      errors.push(
        validationError(
          "REGISTRY_ITEM_TYPE",
          item.name,
          `libs/keys ships ${REGISTRY_ITEM_TYPE.hook} items only; found "${item.type}"`,
        ),
      );
      continue;
    }

    if (item.files.length === 0) {
      errors.push(
        validationError("REGISTRY_HOOK_FILES", item.name, `Hook has an empty files list`),
      );
      continue;
    }

    const hasSourceFile = item.files.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"));
    if (!hasSourceFile) {
      errors.push(
        validationError("REGISTRY_HOOK_FILES", item.name, `Hook has no TypeScript source files`),
      );
    }

    for (const file of item.files) {
      const allowedPrefixes = ["src/hooks/", "src/core/", "src/dom/"];
      if (!allowedPrefixes.some((prefix) => file.path.startsWith(prefix))) {
        errors.push(
          validationError(
            "REGISTRY_HOOK_PATH",
            item.name,
            `Hook registry file must live under src/hooks/, src/core/, or src/dom/ for shadcn install paths: ${file.path}`,
          ),
        );
      }
    }
  }

  return errors;
}
