import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { RELATIVE_JS_IMPORT_RE, stripRelativeJsExtensions } from "@diffgazer/registry";

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

interface RegistryFileWithContent {
  path: string;
  target?: string;
  content?: string;
}

interface PublicRegistryItemJson {
  files?: RegistryFileWithContent[];
  meta?: { hidden?: boolean };
}

interface PublicRegistryIndexJson {
  items?: PublicRegistryItemJson[];
}

function buildItemPathMaps(registryPath: string): Map<string, Map<string, string>> {
  interface RegistryFile {
    path: string;
    target?: string;
  }
  interface RegistryItem {
    name: string;
    files?: RegistryFile[];
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as { items?: RegistryItem[] };
  const maps = new Map<string, Map<string, string>>();
  for (const item of registry.items ?? []) {
    const pathMap = new Map<string, string>();
    for (const file of item.files ?? []) {
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
    if (!entry.endsWith(".json")) continue;

    const item = JSON.parse(
      readFileSync(join(outputDir, entry), "utf-8"),
    ) as PublicRegistryItemJson;
    for (const file of item.files ?? []) {
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
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as PublicRegistryIndexJson;

  if (index.items) {
    const before = index.items.length;
    index.items = index.items.filter((item) => !item.meta?.hidden);
    if (index.items.length !== before) {
      writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    }
  }

  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    let changed = false;

    const pathMap = new Map<string, string>();
    for (const file of item.files ?? []) {
      if (file.target) {
        pathMap.set(file.path, file.target);
      }
    }

    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue;

      let nextContent = transformKeysPublicRegistryImportContent(file.content);

      if (file.target && pathMap.size > 0) {
        nextContent = rewriteImportsForTargetLayout(nextContent, file.path, file.target, pathMap);
      }

      if (nextContent === file.content) continue;

      file.content = nextContent;
      changed = true;
    }

    if (changed) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
