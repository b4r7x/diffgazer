import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  listPublicRegistryEntries,
  rewriteKeysPackageImportsInContent,
  stripRelativeJsExtensions,
} from "@diffgazer/registry";
import { parseKeysDependencyRef } from "@diffgazer/registry/schemas";
import type { PublicRegistryIndexJson, PublicRegistryItemJson } from "./public-registry-json.js";
import { transformRegistryDependencies } from "./registry-dependencies.js";

// Shipped copy source must stay within the repository's Biome line width, so the
// rewritten import wraps exactly the way Biome formats an over-long named import.
const BIOME_LINE_WIDTH = 100;

function renderImport(specifiers: string[], target: string, quote: string): string {
  const source = `${quote}@/hooks/${target}${quote}`;
  const singleLine = `import { ${specifiers.join(", ")} } from ${source};`;
  if (singleLine.length <= BIOME_LINE_WIDTH) return singleLine;

  const block = specifiers.map((specifier) => `  ${specifier},`).join("\n");
  return `import {\n${block}\n} from ${source};`;
}

function stripCssSideEffectImports(content: string): string {
  return content.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*\n?/gm, "");
}

export function transformUiPublicRegistryKeysImportContent(
  content: string,
  options?: { shimHookBasename?: string },
): string {
  const keysRewritten = rewriteKeysPackageImportsInContent(content, {
    shimHookBasename: options?.shimHookBasename,
    renderImport,
  });
  const cssStripped = stripCssSideEffectImports(keysRewritten);
  return stripRelativeJsExtensions(cssStripped);
}

export function isHiddenKeysShim(item: PublicRegistryItemJson): boolean {
  return (
    item.meta?.hidden === true &&
    item.name?.startsWith("use-") === true &&
    (item.registryDependencies ?? []).some((dep) => parseKeysDependencyRef(dep) !== null)
  );
}

export function transformUiPublicRegistryKeysImports(outputDir: string): void {
  const indexPath = join(outputDir, "registry.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as PublicRegistryIndexJson;
  let indexChanged = false;

  if (index.items) {
    const before = index.items.length;
    index.items = index.items.filter((item) => !item.meta?.hidden);
    if (index.items.length !== before) indexChanged = true;
  }

  for (const item of index.items ?? []) {
    indexChanged = transformRegistryDependencies(item) || indexChanged;
  }

  if (indexChanged) {
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  }

  for (const { itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;

    if (isHiddenKeysShim(item)) {
      unlinkSync(itemPath);
      continue;
    }

    let changed = transformRegistryDependencies(item);
    const shimHookBasename = item.name?.startsWith("use-") ? item.name : undefined;

    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue;

      const nextContent = transformUiPublicRegistryKeysImportContent(file.content, {
        shimHookBasename,
      });
      if (nextContent === file.content) continue;

      file.content = nextContent;
      changed = true;
    }

    if (changed) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
