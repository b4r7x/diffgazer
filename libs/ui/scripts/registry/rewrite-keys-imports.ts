import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KEYS_PACKAGE_IMPORT_TARGETS, REGISTRY_ORIGIN } from "@diffgazer/registry";

function specifierName(specifier: string): string {
  return specifier
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/)[0]
    ?.trim() ?? "";
}

function renderImport(specifiers: string[], target: string, quote: string): string {
  return `import { ${specifiers.join(", ")} } from ${quote}@/hooks/${target}${quote};`;
}

function rewriteKeysPackageImportLine(line: string): string {
  const match = /^(\s*)import\s+(type\s+)?\{([^}]+)\}\s+from\s+(["'])@diffgazer\/keys\4;?\s*$/.exec(line);
  if (!match) return line;

  const indent = match[1] ?? "";
  const typePrefix = match[2] ?? "";
  const quote = match[4] ?? "\"";
  const grouped = new Map<string, string[]>();
  const unknown: string[] = [];

  for (const rawSpecifier of (match[3] ?? "").split(",")) {
    const specifier = rawSpecifier.trim();
    if (!specifier) continue;

    const target = KEYS_PACKAGE_IMPORT_TARGETS.get(specifierName(specifier));
    if (!target) {
      unknown.push(`${typePrefix}${specifier}`.trim());
      continue;
    }

    const specifiers = grouped.get(target) ?? [];
    specifiers.push(`${typePrefix}${specifier}`.trim());
    grouped.set(target, specifiers);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown @diffgazer/keys import specifiers in public registry copy content: ${unknown.join(", ")}. ` +
      `Add them to KEYS_PACKAGE_IMPORT_TARGETS in rewrite-keys-imports.ts.`,
    );
  }

  const rewritten = [...grouped.entries()].map(([target, specifiers]) =>
    indent + renderImport(specifiers, target, quote),
  );

  return rewritten.length > 0 ? rewritten.join("\n") : line;
}

function stripRelativeJsExtensions(content: string): string {
  return content.replace(
    /(\bfrom\s+|\bimport\s+|\bimport\(\s*|\brequire\(\s*)(["'])(\.{1,2}\/[^"']+)\.js\2/g,
    (_: string, prefix: string, quote: string, specifier: string) => `${prefix}${quote}${specifier}${quote}`,
  );
}

function stripCssSideEffectImports(content: string): string {
  return content.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*\n?/gm, "");
}

export function transformUiPublicRegistryKeysImportContent(content: string): string {
  const keysRewritten = content.split("\n").map(rewriteKeysPackageImportLine).join("\n");
  const cssStripped = stripCssSideEffectImports(keysRewritten);
  return stripRelativeJsExtensions(cssStripped);
}

interface RegistryFileWithContent {
  content?: string;
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

export function transformUiPublicRegistryItem<T extends { registryDependencies?: string[] }>(item: T): T {
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
    const item = JSON.parse(readFileSync(itemPath, "utf-8")) as PublicRegistryItemJson;
    let changed = transformRegistryDependencies(item);

    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue;

      const nextContent = transformUiPublicRegistryKeysImportContent(file.content);
      if (nextContent === file.content) continue;

      file.content = nextContent;
      changed = true;
    }

    if (changed) {
      writeFileSync(itemPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }
}
