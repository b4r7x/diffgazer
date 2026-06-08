import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY_ORIGIN, rewriteKeysPackageImportsInContent } from "@diffgazer/registry";

function renderImport(specifiers: string[], target: string, quote: string, indent: string): string {
  return `${indent}import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`;
}

function rewriteKeysPackageImportLine(line: string): string {
  return rewriteKeysPackageImportsInContent(`${line}\n`, {
    renderImport,
  }).trimEnd();
}

function stripRelativeJsExtensions(content: string): string {
  return content.replace(
    /(\bfrom\s+|\bimport\s+|\bimport\(\s*|\brequire\(\s*)(["'])(\.{1,2}\/[^"']+)\.js\2/g,
    (_: string, prefix: string, quote: string, specifier: string) =>
      `${prefix}${quote}${specifier}${quote}`,
  );
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

// Kept for tests that exercise single-line rewrite behavior.
export { rewriteKeysPackageImportLine };
