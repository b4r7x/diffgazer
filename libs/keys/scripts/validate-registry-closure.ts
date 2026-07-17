import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractImportSpecifiers, RELATIVE_JS_IMPORT_RE } from "@diffgazer/registry";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import { createKeysSourceContentTransform } from "./transform-public-registry-imports.js";

interface ValidationError {
  code: string;
  item: string;
  message: string;
}

function validationError(code: string, item: string, message: string): ValidationError {
  return { code, item, message };
}

function validateImportClosure(registry: Registry, registryRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const item of registry.items) {
    if (item.type !== REGISTRY_ITEM_TYPE.hook) continue;

    const includedFiles = new Set(item.files.map((f) => f.path));

    for (const file of item.files) {
      const filePath = resolve(registryRoot, file.path);
      if (!existsSync(filePath)) {
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

        const tryPaths = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.tsx`,
        ];

        let found = false;
        let foundRelativePath = "";

        for (const tryPath of tryPaths) {
          if (existsSync(tryPath)) {
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

function extractRelativeImports(content: string): string[] {
  return [...new Set(extractImportSpecifiers(content).map(({ specifier }) => specifier))].filter(
    (specifier) => specifier.startsWith("."),
  );
}

function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

function validateRegistryStructure(registry: Registry): ValidationError[] {
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

function validatePublicTargetClosure(publicDir: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(publicDir, entry);
    let item: RegistryItem;
    try {
      item = parseRegistryEntry(JSON.parse(readFileSync(itemPath, "utf-8")));
    } catch {
      errors.push(validationError("PUBLIC_TARGET_CLOSURE", entry, `Failed to parse ${entry}`));
      continue;
    }

    if (item.type !== REGISTRY_ITEM_TYPE.hook) continue;

    const targetPaths = new Set<string>();
    const targetPathsWithExt = new Set<string>();
    for (const file of item.files) {
      const target = file.target ?? file.path;
      targetPathsWithExt.add(target);
      targetPaths.add(target.replace(/\.(ts|tsx)$/, ""));
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      const target = file.target ?? file.path;
      const targetDir = dirname(target);
      const imports = extractRelativeImports(file.content);

      for (const importPath of imports) {
        const resolved = posix.normalize(posix.join(targetDir, importPath));
        const resolvedWithoutExt = resolved.replace(/\.(ts|tsx)$/, "");

        const found =
          targetPaths.has(resolvedWithoutExt) ||
          targetPaths.has(resolved) ||
          targetPathsWithExt.has(resolved) ||
          targetPathsWithExt.has(`${resolved}.ts`) ||
          targetPathsWithExt.has(`${resolved}.tsx`);

        if (!found) {
          errors.push(
            validationError(
              "PUBLIC_TARGET_CLOSURE",
              item.name,
              `Target import "${importPath}" from ${target} does not resolve to any installed file`,
            ),
          );
        }
      }
    }
  }

  return errors;
}

function validateNoJsImportsInPublicContent(publicDir: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(publicDir, entry);
    let item: RegistryItem;
    try {
      item = parseRegistryEntry(JSON.parse(readFileSync(itemPath, "utf-8")));
    } catch {
      continue;
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      RELATIVE_JS_IMPORT_RE.lastIndex = 0;
      const match = RELATIVE_JS_IMPORT_RE.exec(file.content);
      if (match) {
        errors.push(
          validationError(
            "PUBLIC_JS_IMPORT",
            item.name,
            `File ${file.target ?? file.path} has relative .js import: "${match[3]}.js"`,
          ),
        );
      }
    }
  }

  return errors;
}

function validateContentFreshness(publicDir: string, registryRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const transform = createKeysSourceContentTransform(registryRoot);

  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(publicDir, entry);
    let item: RegistryItem;
    try {
      item = parseRegistryEntry(JSON.parse(readFileSync(itemPath, "utf-8")));
    } catch {
      errors.push(validationError("REGISTRY_STALE_CONTENT", entry, `Failed to parse ${entry}`));
      continue;
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      const sourcePath = resolve(registryRoot, file.path);
      if (!existsSync(sourcePath)) {
        errors.push(
          validationError(
            "REGISTRY_STALE_CONTENT",
            item.name,
            `Source file not found for embedded content: ${file.path}`,
          ),
        );
        continue;
      }

      const source = readFileSync(sourcePath, "utf-8");
      const expected = transform({ itemName: item.name, filePath: file.path, content: source });
      if (expected !== file.content) {
        errors.push(
          validationError(
            "REGISTRY_STALE_CONTENT",
            item.name,
            `Embedded content for ${file.path} is stale; run "pnpm --filter @diffgazer/keys build:shadcn" to regenerate`,
          ),
        );
      }
    }
  }

  return errors;
}

export function validateRegistryClosure(registryPath: string): boolean {
  const registryRoot = resolve(registryPath, "..", "..");

  let registry: Registry;
  try {
    registry = RegistrySchema.parse(JSON.parse(readFileSync(registryPath, "utf-8")));
  } catch (e) {
    console.error(`Failed to read registry: ${e}`);
    return false;
  }

  const errors = [
    ...validateRegistryStructure(registry),
    ...validateImportClosure(registry, registryRoot),
  ];

  const publicDir = resolve(registryRoot, "public", "r");
  if (existsSync(publicDir)) {
    errors.push(...validatePublicTargetClosure(publicDir));
    errors.push(...validateNoJsImportsInPublicContent(publicDir));
    errors.push(...validateContentFreshness(publicDir, registryRoot));
  }

  if (errors.length === 0) {
    return true;
  }

  console.error("\n Registry closure validation failed with errors:\n");
  const groupedErrors = new Map<string, ValidationError[]>();

  for (const error of errors) {
    let group = groupedErrors.get(error.code);
    if (!group) {
      group = [];
      groupedErrors.set(error.code, group);
    }
    group.push(error);
  }

  for (const [code, items] of groupedErrors) {
    console.error(`[${code}] (${items.length} error${items.length > 1 ? "s" : ""})`);
    for (const error of items) {
      console.error(`  ${error.item}: ${error.message}`);
    }
    console.error("");
  }

  return false;
}

export {
  validatePublicTargetClosure,
  validateNoJsImportsInPublicContent,
  validateContentFreshness,
  extractRelativeImports,
};

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const registryPath = resolve(import.meta.dirname, "..", "registry", "registry.json");
  const success = validateRegistryClosure(registryPath);
  process.exit(success ? 0 : 1);
}
