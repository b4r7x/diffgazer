import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { RELATIVE_JS_IMPORT_RE, stripRelativeJsExtensions } from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";
import { RegistrySchema } from "@diffgazer/registry/schemas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRegistryEntry(raw: unknown): RegistryItem {
  const [item] = RegistrySchema.parse({ items: [raw] }).items;
  if (!item) throw new Error("Missing registry item");
  return item;
}

export function transformKeysPublicRegistryImportContent(content: string): string {
  return stripRelativeJsExtensions(content);
}

export const RELATIVE_IMPORT =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["']))(\.{1,2}\/[^"']+)\2/g;

export function rewriteImportsForTargetLayout(
  content: string,
  sourcePath: string,
  targetPath: string,
  pathMap: Map<string, string>,
): string {
  const sourceDir = dirname(sourcePath);
  const targetDir = dirname(targetPath);

  return content.replace(
    RELATIVE_IMPORT,
    (match: string, prefix: string, quote: string, specifier: string) => {
      const resolvedSource = posix.normalize(posix.join(sourceDir, specifier));
      const candidates = [resolvedSource, `${resolvedSource}.ts`, `${resolvedSource}.tsx`];

      let resolvedTarget: string | null = null;
      for (const candidate of candidates) {
        const target = pathMap.get(candidate);
        if (target) {
          resolvedTarget = target;
          break;
        }
      }

      if (!resolvedTarget) return match;

      const targetWithoutExt = resolvedTarget.replace(/\.(ts|tsx)$/, "");
      let relative = posix.relative(targetDir, targetWithoutExt);
      if (!relative.startsWith(".")) relative = `./${relative}`;

      return `${prefix}${relative}${quote}`;
    },
  );
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
      transformed = rewriteImportsForTargetLayout(transformed, filePath, targetPath, pathMap);
    }
    return transformed;
  };
}

export function assertNoRelativeJsImports(outputDir: string): void {
  const offenders: string[] = [];

  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const item = parseRegistryEntry(JSON.parse(readFileSync(join(outputDir, entry), "utf-8")));
    for (const file of item.files) {
      if (typeof file.content !== "string") continue;
      const matches = file.content.match(new RegExp(RELATIVE_JS_IMPORT_RE.source, "g"));
      if (matches) {
        offenders.push(`${entry} (${file.target ?? file.path}): ${matches.join(", ")}`);
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
  const indexJson: unknown = JSON.parse(readFileSync(indexPath, "utf-8"));
  const index = RegistrySchema.parse(indexJson);

  const before = index.items.length;
  const publicItems = index.items.filter((item) => item.meta?.hidden !== true);
  if (publicItems.length !== before) {
    const nextIndex = isRecord(indexJson)
      ? { ...indexJson, items: publicItems }
      : { items: publicItems };
    writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`);
  }

  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
    const rawItem: unknown = JSON.parse(readFileSync(itemPath, "utf-8"));
    const item = parseRegistryEntry(rawItem);

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
        nextContent = rewriteImportsForTargetLayout(nextContent, file.path, file.target, pathMap);
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
