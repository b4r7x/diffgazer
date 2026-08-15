import { existsSync, readFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
import {
  findRelativeJsSpecifiers,
  listPublicRegistryEntries,
  readRegistryItem,
} from "@diffgazer/registry";
import type { Registry, RegistryItem } from "@diffgazer/registry/schemas";
import { createKeysSourceContentTransform } from "../transform-public-registry-imports.js";
import { extractRelativeImports, type ValidationError, validationError } from "./types.js";

export function validatePublicTargetClosure(publicDir: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const { entry, itemPath } of listPublicRegistryEntries(publicDir)) {
    let item: RegistryItem;
    try {
      item = readRegistryItem(itemPath);
    } catch {
      errors.push(validationError("PUBLIC_TARGET_CLOSURE", entry, `Failed to parse ${entry}`));
      continue;
    }

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

  for (const { entry, itemPath } of listPublicRegistryEntries(publicDir)) {
    let item: RegistryItem;
    try {
      item = readRegistryItem(itemPath);
    } catch {
      errors.push(validationError("PUBLIC_JS_IMPORT", entry, `Failed to parse ${entry}`));
      continue;
    }

    for (const file of item.files) {
      if (typeof file.content !== "string") continue;

      const [specifier] = findRelativeJsSpecifiers(file.content);
      if (specifier) {
        errors.push(
          validationError(
            "PUBLIC_JS_IMPORT",
            item.name,
            `File ${file.target ?? file.path} has relative .js import: "${specifier}"`,
          ),
        );
      }
    }
  }

  return errors;
}

const canonicalMeta = (meta: RegistryItem["meta"]): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(meta ?? {}).sort(([left], [right]) => (left < right ? -1 : 1)),
    ),
  );

/**
 * Freshness compares embedded file content only, so a meta-only drift ships
 * silently — a public payload can promise an RSC boundary (`meta.client`) or a
 * catalog listing (`meta.hidden`) that the source registry no longer declares.
 */
export function validateMetaFreshness(publicDir: string, registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];
  const sourceItems = new Map(registry.items.map((item) => [item.name, item]));

  for (const { entry, itemPath } of listPublicRegistryEntries(publicDir)) {
    let item: RegistryItem;
    try {
      item = readRegistryItem(itemPath);
    } catch {
      errors.push(validationError("REGISTRY_STALE_META", entry, `Failed to parse ${entry}`));
      continue;
    }

    const source = sourceItems.get(item.name);
    if (!source) continue;

    const published = canonicalMeta(item.meta);
    const declared = canonicalMeta(source.meta);
    if (published === declared) continue;

    errors.push(
      validationError(
        "REGISTRY_STALE_META",
        item.name,
        `Published meta ${published} does not match source meta ${declared}; run "pnpm --filter @diffgazer/keys build:shadcn" to regenerate`,
      ),
    );
  }

  return errors;
}

export function validateContentFreshness(
  publicDir: string,
  registryRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const transform = createKeysSourceContentTransform(registryRoot);

  for (const { entry, itemPath } of listPublicRegistryEntries(publicDir)) {
    let item: RegistryItem;
    try {
      item = readRegistryItem(itemPath);
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
