import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Registry } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE } from "@diffgazer/registry/schemas";
import { extractRelativeImports, validationError, type ValidationError } from "./types.js";

function isExistingFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

export function validateImportClosure(registry: Registry, registryRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    if (item.type !== REGISTRY_ITEM_TYPE.hook) continue;

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
    if (item.type !== REGISTRY_ITEM_TYPE.hook) continue;

    if (!item.files || !Array.isArray(item.files) || item.files.length === 0) {
      errors.push(validationError("REGISTRY_HOOK_FILES", item.name, `Hook missing files array`));
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
