import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findRelativeJsSpecifiers,
  listPublicRegistryEntries,
  readRegistryItem,
  rewriteRelativeImportsForTargetLayout,
  stripRelativeJsExtensions,
} from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { RegistryItemSchema, RegistrySchema } from "@diffgazer/registry/schemas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates the index against the schema but hands back the raw JSON: every
 * write-back below edits raw values, because reserializing parsed items would
 * strip keys the schema omits.
 */
function readRawRegistryIndex(indexPath: string): {
  json: Record<string, unknown>;
  items: unknown[];
} {
  const json: unknown = JSON.parse(readFileSync(indexPath, "utf-8"));
  RegistrySchema.parse(json);
  if (!isRecord(json) || !Array.isArray(json.items)) {
    throw new Error(`Registry index ${indexPath} is not a shadcn registry object`);
  }
  return { json, items: json.items };
}

function isHiddenRawItem(raw: unknown): boolean {
  return isRecord(raw) && isRecord(raw.meta) && raw.meta.hidden === true;
}

function transformKeysPublicRegistryImportContent(content: string): string {
  return stripRelativeJsExtensions(content);
}

const SRC_HOOKS_PREFIX = "src/hooks/";
const HOOKS_TARGET_PREFIX = "@hooks/";

// shadcn 4.7.0 writes literal `src/hooks/...` targets to cwd-relative paths,
// ignoring `resolvedPaths.hooks`. Pinning `@hooks/<subpath>` makes shadcn resolve
// each file within the configured hooks alias root (mirrors the UI `@ui/` handoff).
// Source registry keeps `src/hooks/...` targets for copy/package install paths.
export function deriveKeysRegistryTarget(file: {
  path?: string;
  type?: string;
  target?: string;
}): string | undefined {
  if (file.target?.startsWith(SRC_HOOKS_PREFIX)) {
    return `${HOOKS_TARGET_PREFIX}${file.target.slice(SRC_HOOKS_PREFIX.length)}`;
  }
  if (file.path?.startsWith(SRC_HOOKS_PREFIX)) {
    return `${HOOKS_TARGET_PREFIX}${file.path.slice(SRC_HOOKS_PREFIX.length)}`;
  }
  return file.target;
}

export function transformKeysPublicRegistrySourceItem(item: RegistryItem): RegistryItem {
  let changed = false;
  const files = item.files.map((file) => {
    const target = deriveKeysRegistryTarget(file);
    if (target === file.target) return file;
    changed = true;
    return { ...file, target };
  });
  return changed ? { ...item, files } : item;
}

function applyKeysRegistryTargetsToRawItem(rawItem: Record<string, unknown>): boolean {
  if (!Array.isArray(rawItem.files)) return false;

  let changed = false;
  for (const rawFile of rawItem.files) {
    if (!isRecord(rawFile) || typeof rawFile.path !== "string") continue;
    const target = deriveKeysRegistryTarget({
      path: rawFile.path,
      type: typeof rawFile.type === "string" ? rawFile.type : undefined,
      target: typeof rawFile.target === "string" ? rawFile.target : undefined,
    });
    if (target === rawFile.target) continue;
    rawFile.target = target;
    changed = true;
  }
  return changed;
}

export function applyKeysRegistryTargetsInPublicRegistry(outputDir: string): void {
  const indexPath = join(outputDir, "registry.json");
  const rawIndex = readRawRegistryIndex(indexPath);

  let indexChanged = false;
  for (const rawItem of rawIndex.items) {
    if (isRecord(rawItem) && applyKeysRegistryTargetsToRawItem(rawItem)) indexChanged = true;
  }
  if (indexChanged) {
    writeFileSync(indexPath, `${JSON.stringify(rawIndex.json, null, 2)}\n`);
  }

  for (const { entry, itemPath } of listPublicRegistryEntries(outputDir)) {
    const rawItem: unknown = JSON.parse(readFileSync(itemPath, "utf-8"));
    if (!isRecord(rawItem)) {
      throw new Error(`Registry item ${entry} is not a shadcn item object`);
    }
    if (!applyKeysRegistryTargetsToRawItem(rawItem)) continue;
    writeFileSync(itemPath, `${JSON.stringify(rawItem, null, 2)}\n`);
  }
}

// The public shadcn build maps one registry item at a time, so an import into a
// sibling item resolves to nothing here and must be left as written.
function rewriteForPublicItemLayout(
  content: string,
  sourcePath: string,
  targetPath: string,
  pathMap: ReadonlyMap<string, string>,
): string {
  return rewriteRelativeImportsForTargetLayout({
    content,
    sourcePath,
    targetPath,
    pathMap,
    unresolved: "keep",
  });
}

function buildItemPathMaps(registryPath: string): Map<string, Map<string, string>> {
  const registry = RegistrySchema.parse(JSON.parse(readFileSync(registryPath, "utf-8")));
  const maps = new Map<string, Map<string, string>>();
  for (const item of registry.items) {
    const pathMap = new Map<string, string>();
    for (const file of item.files) {
      if (file.target) pathMap.set(file.path, file.target);
    }
    if (pathMap.size > 0) maps.set(item.name, pathMap);
  }
  return maps;
}

export function createKeysSourceContentTransform(
  rootDir: string,
): (ctx: { itemName: string; filePath: string; content: string }) => string {
  const registryPath = resolve(rootDir, "registry/registry.json");
  const itemPathMaps = buildItemPathMaps(registryPath);

  return ({ itemName, filePath, content }) => {
    let transformed = transformKeysPublicRegistryImportContent(content);
    const pathMap = itemPathMaps.get(itemName);
    const targetPath = pathMap?.get(filePath);
    if (pathMap && targetPath) {
      transformed = rewriteForPublicItemLayout(transformed, filePath, targetPath, pathMap);
    }
    return transformed;
  };
}

export function assertNoRelativeJsImports(outputDir: string): void {
  const offenders: string[] = [];

  for (const { entry, itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = readRegistryItem(itemPath);
    for (const file of item.files) {
      if (typeof file.content !== "string") continue;
      const specifiers = findRelativeJsSpecifiers(file.content);
      if (specifiers.length > 0) {
        offenders.push(`${entry} (${file.target ?? file.path}): ${specifiers.join(", ")}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        "Generated keys public registry contains relative .js import specifiers:",
        ...offenders,
        "Strip .js from libs/keys/src source imports; do not rely on the downstream UI build cleanup.",
      ].join("\n"),
    );
  }
}

export function transformKeysPublicRegistryImports(outputDir: string): void {
  const indexPath = join(outputDir, "registry.json");
  const rawIndex = readRawRegistryIndex(indexPath);

  const publicItems = rawIndex.items.filter((item) => !isHiddenRawItem(item));
  if (publicItems.length !== rawIndex.items.length) {
    writeFileSync(
      indexPath,
      `${JSON.stringify({ ...rawIndex.json, items: publicItems }, null, 2)}\n`,
    );
  }

  for (const { entry, itemPath } of listPublicRegistryEntries(outputDir)) {
    const rawItem: unknown = JSON.parse(readFileSync(itemPath, "utf-8"));
    const item = RegistryItemSchema.parse(rawItem);

    const pathMap = new Map<string, string>();
    for (const file of item.files) {
      if (file.target) {
        pathMap.set(file.path, file.target);
      }
    }

    const rewrittenContent = new Map<number, string>();
    item.files.forEach((file, index) => {
      if (typeof file.content !== "string") return;

      let nextContent = transformKeysPublicRegistryImportContent(file.content);

      if (file.target && pathMap.size > 0) {
        nextContent = rewriteForPublicItemLayout(nextContent, file.path, file.target, pathMap);
      }

      if (nextContent !== file.content) rewrittenContent.set(index, nextContent);
    });

    if (rewrittenContent.size === 0) continue;

    // Write back onto raw JSON; reserializing the parsed item would strip keys the schema omits.
    if (!isRecord(rawItem) || !Array.isArray(rawItem.files)) {
      throw new Error(`Registry item ${entry} is not a shadcn item object`);
    }
    for (const [index, content] of rewrittenContent) {
      const rawFile = rawItem.files[index];
      if (isRecord(rawFile)) rawFile.content = content;
    }

    writeFileSync(itemPath, `${JSON.stringify(rawItem, null, 2)}\n`);
  }
}
