import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTRY_ORIGIN,
  rewriteKeysPackageImportsInContent,
  stripRelativeJsExtensions,
} from "@diffgazer/registry";
import type { RegistryItem } from "@diffgazer/registry/schemas";

function renderImport(specifiers: string[], target: string, quote: string, indent: string): string {
  return `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`;
}

function rewriteKeysPackageImportLine(line: string): string {
  return rewriteKeysPackageImportsInContent(`${line}\n`, {
    renderImport,
  }).trimEnd();
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
  registryDependencies?: string[];
  files?: RegistryFileWithContent[];
  meta?: { hidden?: boolean };
}

interface PublicRegistryIndexJson {
  items?: PublicRegistryItemJson[];
}

function toDirectRegistryDependency(dep: string): string {
  if (dep.startsWith("http://") || dep.startsWith("https://")) return dep;
  if (dep.startsWith("@diffgazer-keys/") || dep.startsWith("@diffgazer/keys/")) {
    const name = dep.replace(/^@diffgazer-keys\/|^@diffgazer\/keys\//, "");
    return `${REGISTRY_ORIGIN}/r/keys/${name}.json`;
  }
  if (dep.startsWith("@")) return dep;
  return `${REGISTRY_ORIGIN}/r/ui/${dep}.json`;
}

export function transformUiPublicRegistryItem<T extends { registryDependencies?: string[] }>(
  item: T,
): T {
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
const UI_TARGET_PREFIX = "@ui/";

// shadcn 4.7.0 resolves a no-target `registry:ui` file's destination by finding the
// trailing segment of the configured `ui` alias directory inside the file path. When
// that segment isn't literally "ui" (e.g. an alias of `@/app/interface/components`,
// trailing segment "components"), it never matches a `registry/ui/...` path, so every
// file collapses to its basename: `index.ts` files across components collide and
// cross-folder relative imports (`../dialog`, `../icons/chevron`) break. Pinning each
// file to an `@ui/<subpath>` target makes shadcn resolve it within the configured ui
// alias root instead, preserving the component subtree under any alias. For the default
// `@/components/ui` alias the destination is identical, so the target is a no-op there.
// The source registry keeps these files target-free so the copy/package bundle, which
// installs by source path, is untouched — the target lives only in the shadcn handoff.
function deriveUiRegistryTarget(file: {
  path?: string;
  type?: string;
  target?: string;
}): string | undefined {
  if (file.type !== "registry:ui" || !file.path?.startsWith(UI_REGISTRY_PATH_PREFIX)) {
    return file.target;
  }
  return `${UI_TARGET_PREFIX}${file.path.slice(UI_REGISTRY_PATH_PREFIX.length)}`;
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

// Single source of truth for the source→public item shape: direct-URL registry
// dependencies plus the derived `@ui/` file targets. Used both to build the public
// item and to compute the expected item during freshness validation.
export function transformUiPublicRegistrySourceItem(item: RegistryItem): RegistryItem {
  return applyUiRegistryTargets(transformUiPublicRegistryItem(item));
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

  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
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
    (item.registryDependencies ?? []).some(
      (dep) => dep.startsWith("@diffgazer-keys/") || dep.startsWith("@diffgazer/keys/"),
    )
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

  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;

    const itemPath = join(outputDir, entry);
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

// Kept for tests that exercise single-line rewrite behavior.
export { rewriteKeysPackageImportLine };
