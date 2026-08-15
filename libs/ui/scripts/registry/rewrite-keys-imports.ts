import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  aggregateThemeStyles,
  listPublicRegistryEntries,
  REGISTRY_ORIGIN,
  rewriteKeysPackageImportsInContent,
  stripRelativeJsExtensions,
} from "@diffgazer/registry";
import {
  parseKeysDependencyRef,
  type RegistryItem,
  RegistrySchema,
} from "@diffgazer/registry/schemas";

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

interface RegistryFileWithContent {
  content?: string;
  path?: string;
  type?: string;
  target?: string;
}

interface PublicRegistryItemJson {
  name?: string;
  type?: string;
  registryDependencies?: string[];
  files?: RegistryFileWithContent[];
  meta?: { hidden?: boolean };
}

interface PublicRegistryIndexJson {
  items?: PublicRegistryItemJson[];
}

export type ThemeStyleStripPolicy = (
  itemName: string,
  filePath: string,
  content: string,
) => boolean;

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

  return (itemName, _filePath, content) => {
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

function toDirectRegistryDependency(dep: string): string {
  if (dep.startsWith("http://") || dep.startsWith("https://")) return dep;
  const keysHook = parseKeysDependencyRef(dep);
  if (keysHook) return `${REGISTRY_ORIGIN}/r/keys/${keysHook}.json`;
  if (dep.startsWith("@")) return dep;
  return `${REGISTRY_ORIGIN}/r/ui/${dep}.json`;
}

function transformUiPublicRegistryItem<T extends { registryDependencies?: string[] }>(item: T): T {
  if (!Array.isArray(item.registryDependencies)) return item;

  return {
    ...item,
    registryDependencies: item.registryDependencies.map(toDirectRegistryDependency),
  };
}

function transformRegistryDependencies(item: PublicRegistryItemJson): boolean {
  const next = transformUiPublicRegistryItem(item);
  if (next.registryDependencies === item.registryDependencies) return false;

  item.registryDependencies = next.registryDependencies;
  return true;
}

const UI_REGISTRY_PATH_PREFIX = "registry/ui/";
const LIB_REGISTRY_PATH_PREFIX = "registry/lib/";
const HOOK_REGISTRY_PATH_PREFIX = "registry/hooks/";
const UI_TARGET_PREFIX = "@ui/";
const LIB_TARGET_PREFIX = "@lib/";
const HOOK_TARGET_PREFIX = "@hooks/";

// shadcn 4.7.0 resolves a no-target `registry:ui` file's destination by finding the
// trailing segment of the configured `ui` alias directory inside the file path. When
// that segment isn't literally "ui" (e.g. an alias of `@/app/interface/components`,
// trailing segment "components"), it never matches a `registry/ui/...` path, so every
// file collapses to its basename: `index.ts` files across components collide and
// cross-folder relative imports (`../dialog`, `../icons/chevron`) break. Pinning each
// file to an `@ui/<subpath>` target makes shadcn resolve it within the configured ui
// alias root instead, preserving the component subtree under any alias. For the default
// `@/components/ui` alias the destination is identical, so the target is a no-op there.
//
// The same flattening hits nested `registry:lib` and `registry:hook` subtrees (e.g.
// `registry/lib/diff/index.ts` → `index.ts` when `aliases.lib` does not end in `lib`),
// breaking `@/lib/diff` imports. Pin `@lib/<subpath>` / `@hooks/<subpath>` only when the
// path has a nested directory — flat `registry/lib/utils.ts` files already land correctly.
//
// The source registry keeps these files target-free so the copy/package bundle, which
// installs by source path, is untouched — the target lives only in the shadcn handoff.
export function deriveUiRegistryTarget(file: {
  path?: string;
  type?: string;
  target?: string;
}): string | undefined {
  const path = file.path;
  if (!path) return file.target;

  if (file.type === "registry:ui" && path.startsWith(UI_REGISTRY_PATH_PREFIX)) {
    return `${UI_TARGET_PREFIX}${path.slice(UI_REGISTRY_PATH_PREFIX.length)}`;
  }

  if (file.type === "registry:lib" && path.startsWith(LIB_REGISTRY_PATH_PREFIX)) {
    const subpath = path.slice(LIB_REGISTRY_PATH_PREFIX.length);
    if (subpath.includes("/")) return `${LIB_TARGET_PREFIX}${subpath}`;
  }

  if (file.type === "registry:hook" && path.startsWith(HOOK_REGISTRY_PATH_PREFIX)) {
    const subpath = path.slice(HOOK_REGISTRY_PATH_PREFIX.length);
    if (subpath.includes("/")) return `${HOOK_TARGET_PREFIX}${subpath}`;
  }

  return file.target;
}

// Mirror the build-time targets onto the source item so the expected shape matches
// the shipped public registry file-by-file during freshness validation.
function applyUiRegistryTargets(item: RegistryItem): RegistryItem {
  let changed = false;
  const files = item.files.map((file) => {
    const target = deriveUiRegistryTarget(file);
    if (target === file.target) return file;
    changed = true;
    return { ...file, target };
  });
  return changed ? { ...item, files } : item;
}

function stripThemeStylesFromSource(
  item: RegistryItem,
  stylePolicy: ThemeStyleStripPolicy | undefined,
  readSourceFile: ((path: string) => string) | undefined,
): RegistryItem {
  if (!stylePolicy || !readSourceFile || item.name === "theme") return item;

  const files = item.files.filter(
    (file) =>
      file.type !== "registry:style" ||
      !stylePolicy(item.name, file.path, readSourceFile(file.path)),
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
        ? !aggregateContent.includes(file.content) ||
          !stylePolicy(item.name ?? "", file.path ?? "", file.content)
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
        stylePolicy(item.name ?? "", file.path, file.content)
      ) {
        const paths = duplicateCarriers.get(item.name ?? "") ?? new Set<string>();
        paths.add(file.path);
        duplicateCarriers.set(item.name ?? "", paths);
      }
    }
  }

  return duplicateCarriers;
}

// Single source of truth for the source→public item shape: direct-URL registry
// dependencies plus the derived `@ui/` file targets. Used both to build the public
// item and to compute the expected item during freshness validation.
export function transformUiPublicRegistrySourceItem(
  item: RegistryItem,
  options: {
    stylePolicy?: ThemeStyleStripPolicy;
    readSourceFile?: (path: string) => string;
  } = {},
): RegistryItem {
  return applyUiRegistryTargets(
    transformUiPublicRegistryItem(
      stripThemeStylesFromSource(item, options.stylePolicy, options.readSourceFile),
    ),
  );
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

function applyUiRegistryTargetsToItems(items: PublicRegistryItemJson[] | undefined): boolean {
  let changed = false;
  for (const item of items ?? []) {
    for (const file of item.files ?? []) {
      const target = deriveUiRegistryTarget(file);
      if (target === file.target) continue;
      file.target = target;
      changed = true;
    }
  }
  return changed;
}

// afterBuild transform: stamp the derived `@ui/` targets onto the generated public
// registry index and every per-item JSON so a real `shadcn add` preserves structure.
export function applyUiRegistryTargetsInPublicRegistry(outputDir: string): void {
  const indexPath = join(outputDir, "registry.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as PublicRegistryIndexJson;
  if (applyUiRegistryTargetsToItems(index.items)) {
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  }

  for (const { itemPath } of listPublicRegistryEntries(outputDir)) {
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    if (applyUiRegistryTargetsToItems([item])) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}

export function isHiddenKeysShim(item: PublicRegistryItemJson & { name?: string }): boolean {
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
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson & {
      name?: string;
    };

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
