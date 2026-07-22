import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { RELATIVE_JS_IMPORT_RE } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "@diffgazer/registry/schemas";
import { createKeysSourceContentTransform } from "../transform-public-registry-imports.js";
import { extractRelativeImports, validationError, type ValidationError } from "./types.js";

function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

export function validatePublicTargetClosure(publicDir: string): ValidationError[] {
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

export function validateNoJsImportsInPublicContent(publicDir: string): ValidationError[] {
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

export function validateContentFreshness(publicDir: string, registryRoot: string): ValidationError[] {
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
