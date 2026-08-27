import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { aggregateThemeStyles, listPublicRegistryEntries } from "@diffgazer/registry";
import { type RegistryItem, RegistrySchema } from "@diffgazer/registry/schemas";
import type { PublicRegistryIndexJson, PublicRegistryItemJson } from "./public-registry-json.js";

export type ThemeStyleStripPolicy = (itemName: string, content: string) => boolean;

export function createThemeStyleStripPolicy(
  sourceItems: readonly RegistryItem[],
  aggregateContent: string,
): ThemeStyleStripPolicy {
  const itemByName = new Map(sourceItems.map((item) => [item.name, item]));
  const closureCache = new Map<string, Set<string>>();

  function dependencyClosure(itemName: string): Set<string> {
    const cached = closureCache.get(itemName);
    if (cached) return cached;

    const closure = new Set<string>();
    const pending = [itemName];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || closure.has(current)) continue;
      closure.add(current);
      for (const dependency of itemByName.get(current)?.registryDependencies ?? []) {
        if (itemByName.has(dependency)) pending.push(dependency);
      }
    }
    closureCache.set(itemName, closure);
    return closure;
  }

  const rootsByItem = new Map<string, RegistryItem[]>();
  const publicRoots = sourceItems.filter((item) => item.meta?.hidden !== true);
  for (const root of publicRoots) {
    for (const itemName of dependencyClosure(root.name)) {
      const roots = rootsByItem.get(itemName) ?? [];
      roots.push(root);
      rootsByItem.set(itemName, roots);
    }
  }

  return (itemName, content) => {
    if (itemName === "theme" || !aggregateContent.includes(content)) return false;
    const roots = rootsByItem.get(itemName) ?? [];
    return roots.length > 0 && roots.every((root) => dependencyClosure(root.name).has("theme"));
  };
}

export function createUiThemeStyleStripPolicy(options: {
  rootDir: string;
  sourceRegistryPath?: string;
}): ThemeStyleStripPolicy {
  const sourceRegistryPath = options.sourceRegistryPath ?? "registry/registry.json";
  const sourceRegistry = RegistrySchema.parse(
    JSON.parse(readFileSync(resolve(options.rootDir, sourceRegistryPath), "utf-8")),
  );
  const aggregateContent = aggregateThemeStyles({
    rootDir: options.rootDir,
    sourceRegistryPath,
    seedContent: readFileSync(resolve(options.rootDir, "styles/styles.css"), "utf-8"),
  });
  return createThemeStyleStripPolicy(sourceRegistry.items, aggregateContent);
}

export function stripThemeStylesFromSource(
  item: RegistryItem,
  stylePolicy: ThemeStyleStripPolicy | undefined,
  readSourceFile: ((path: string) => string) | undefined,
): RegistryItem {
  if (!stylePolicy || !readSourceFile || item.name === "theme") return item;

  const files = item.files.filter(
    (file) => file.type !== "registry:style" || !stylePolicy(item.name, readSourceFile(file.path)),
  );
  return files.length === item.files.length ? item : { ...item, files };
}

function stripThemeStylePaths<T extends PublicRegistryItemJson>(
  item: T,
  stylePolicy: ThemeStyleStripPolicy,
  aggregateContent: string,
  duplicateStyleCarriers: ReadonlyMap<string, ReadonlySet<string>>,
): T {
  if (item.name === "theme" || !item.files) return item;

  const files = item.files.filter(
    (file) =>
      file.type !== "registry:style" ||
      (typeof file.content === "string"
        ? !aggregateContent.includes(file.content) || !stylePolicy(item.name ?? "", file.content)
        : !duplicateStyleCarriers.get(item.name ?? "")?.has(file.path ?? "")),
  );
  return files.length === item.files.length ? item : { ...item, files };
}

function readAggregateThemeStyles(outputDir: string): string {
  const theme = JSON.parse(
    readFileSync(join(outputDir, "theme.json"), "utf-8"),
  ) as PublicRegistryItemJson;
  const aggregate = theme.files?.find((file) => file.target === "~/styles/styles.css")?.content;

  if (typeof aggregate !== "string") {
    throw new Error(
      `theme.json is missing the aggregate ~/styles/styles.css payload in ${outputDir}`,
    );
  }
  return aggregate;
}

function duplicateThemeStyleCarriers(
  outputDir: string,
  stylePolicy: ThemeStyleStripPolicy,
  themeStyles: string,
): ReadonlyMap<string, ReadonlySet<string>> {
  const duplicateCarriers = new Map<string, Set<string>>();
  for (const { itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    if (item.name === "theme" || !item.files) continue;

    for (const file of item.files) {
      if (
        file.type === "registry:style" &&
        file.path &&
        typeof file.content === "string" &&
        themeStyles.includes(file.content) &&
        stylePolicy(item.name ?? "", file.content)
      ) {
        const paths = duplicateCarriers.get(item.name ?? "") ?? new Set<string>();
        paths.add(file.path);
        duplicateCarriers.set(item.name ?? "", paths);
      }
    }
  }

  return duplicateCarriers;
}

/**
 * The shadcn handoff installs the theme's aggregated stylesheet. Remove every
 * non-theme style payload whose bytes are already present in that aggregate from
 * both the index and item JSON after the registry builder has materialized them.
 * Package/copy archives continue to read the source registry and retain their
 * authored per-item style files.
 */
export function removeDuplicateThemeStylesInPublicRegistry(
  outputDir: string,
  stylePolicy: ThemeStyleStripPolicy,
): void {
  const aggregateContent = readAggregateThemeStyles(outputDir);
  const duplicateStyleCarriers = duplicateThemeStyleCarriers(
    outputDir,
    stylePolicy,
    aggregateContent,
  );
  const indexPath = join(outputDir, "registry.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as PublicRegistryIndexJson;
  let indexChanged = false;

  for (const item of index.items ?? []) {
    const next = stripThemeStylePaths(item, stylePolicy, aggregateContent, duplicateStyleCarriers);
    if (next !== item) {
      item.files = next.files;
      indexChanged = true;
    }
  }

  if (indexChanged) writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  for (const { itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    const next = stripThemeStylePaths(item, stylePolicy, aggregateContent, duplicateStyleCarriers);
    if (next === item) continue;
    writeFileSync(itemPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

// Replace the public theme item's styles.css content with the aggregated form
// (seed + every component CSS) so `npx shadcn add` of the theme carries the
// component CSS the per-item `~/styles/<name>.css` files never import. Mirrors the
// tsup styles.css aggregation; `computeAggregated` receives the current seed.
export function aggregateThemeStylesInPublicRegistry(
  outputDir: string,
  computeAggregated: (seedContent: string) => string,
): void {
  const themePath = join(outputDir, "theme.json");
  const theme = JSON.parse(readFileSync(themePath, "utf-8")) as {
    files?: Array<{ target?: string; content?: string }>;
  };

  const stylesFile = theme.files?.find((file) => file.target === "~/styles/styles.css");
  if (!stylesFile || typeof stylesFile.content !== "string") {
    throw new Error("theme.json is missing the styles.css file entry to aggregate");
  }

  stylesFile.content = computeAggregated(stylesFile.content);
  writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);
}
