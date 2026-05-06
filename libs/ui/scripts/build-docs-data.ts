import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDocsData,
  createHookDocLoader,
  findExamples,
  highlightCode,
  DOCS_CODE_THEME_NAME,
  type HookRegistryItem,
  type RegistryItem,
  type ComponentDoc,
  type CodeBlockLine,
  type DocsHighlighter,
  type Registry,
} from "@diffgazer/registry";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_PATH = resolve(ROOT, "registry/registry.json");

function loadRegistryItems(): RegistryItem[] {
  return (JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")) as { items?: RegistryItem[] }).items ?? [];
}

const registryItems = loadRegistryItems();
const loadHookDoc = createHookDocLoader(
  resolve(ROOT, "registry/hook-docs"),
  (name) => name,
);
const COMPONENT_DOCS_DIR = resolve(ROOT, "registry/component-docs");

function isPublicItem(item: RegistryItem): boolean {
  return item.meta?.hidden !== true;
}

function mapHookItem(item: RegistryItem): HookRegistryItem {
  return {
    name: item.name,
    title: item.title ?? item.name,
    description: item.description ?? "",
    files: item.files,
  };
}

async function loadComponentDoc(name: string): Promise<ComponentDoc | null> {
  const docPath = resolve(COMPONENT_DOCS_DIR, `${name}.ts`);
  if (!existsSync(docPath)) return null;

  const exports = await import(docPath) as Record<string, unknown>;
  const doc = Object.values(exports).find((value): value is ComponentDoc => {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  });
  return doc ?? null;
}

function readRegistrySourceFile(item: RegistryItem, file: RegistryItem["files"][number], highlighter: DocsHighlighter) {
  const filePath = resolve(ROOT, file.path);
  const raw = file.content ?? (existsSync(filePath) ? readFileSync(filePath, "utf-8") : null);
  if (raw === null) {
    throw new Error(`Component "${item.name}": file not found at ${filePath}`);
  }

  return {
    raw,
    highlighted: highlightCode(highlighter, raw, "tsx", DOCS_CODE_THEME_NAME),
  };
}

function readExamples(itemName: string, highlighter: DocsHighlighter): {
  examples: string[]
  exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }>
} {
  const examples = findExamples(resolve(ROOT, "registry/examples"), itemName);
  const exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }> = {};

  for (const exampleName of examples) {
    const raw = readFileSync(resolve(ROOT, "registry/examples", itemName, `${exampleName}.tsx`), "utf-8");
    exampleSource[exampleName] = {
      raw,
      highlighted: highlightCode(highlighter, raw, "tsx", DOCS_CODE_THEME_NAME),
    };
  }

  return { examples, exampleSource };
}

async function processComponent(
  item: RegistryItem,
  highlighter: DocsHighlighter,
  _registry: Registry,
): Promise<Record<string, unknown> | null> {
  const docs = await loadComponentDoc(item.name);
  const source = Object.fromEntries(
    item.files.map((file) => [file.path, readRegistrySourceFile(item, file, highlighter)]),
  );
  const mergedSource = item.files
    .map((file) => source[file.path]?.raw)
    .filter((raw): raw is string => typeof raw === "string")
    .join("\n\n");
  const usageExample = docs?.usage?.example;
  const examplesData = readExamples(item.name, highlighter);
  const usageSnippet = docs?.usage?.code
    ?? (usageExample ? examplesData.exampleSource[usageExample]?.raw : undefined)
    ?? "";

  return {
    name: item.name,
    title: item.title ?? item.name,
    description: docs?.description ?? item.description ?? "",
    dependencies: item.dependencies,
    files: item.files.map((file) => file.path),
    props: {},
    source,
    mergedSource,
    mergedSourceHighlighted: highlightCode(highlighter, mergedSource, "tsx", DOCS_CODE_THEME_NAME),
    usageSnippet,
    usageSnippetHighlighted: usageSnippet
      ? highlightCode(highlighter, usageSnippet, docs?.usage?.lang ?? "tsx", DOCS_CODE_THEME_NAME)
      : [],
    examples: examplesData.examples,
    exampleSource: examplesData.exampleSource,
    docs,
    crossDeps: item.meta?.crossDeps,
  };
}

buildDocsData({
  libraryId: "ui",
  rootDir: ROOT,
  registryPath: REGISTRY_PATH,
  examplesDir: resolve(ROOT, "registry/examples"),
  outputDir: resolve(ROOT, "docs/generated"),
  skipMdxGeneration: true,
  hooks: {
    contentDir: resolve(ROOT, "docs/content/hooks"),
    filter: (item) => item.type === "registry:hook" && isPublicItem(item),
    mapItem: mapHookItem,
    loadHookDoc,
    backwardCompatFile: "ui-hooks.json",
  },
  components: {
    contentDir: resolve(ROOT, "docs/content/components"),
    filter: (item) => item.type === "registry:ui" && isPublicItem(item),
    processComponent,
  },
  libs: {
    filter: (item) => item.type === "registry:lib" && isPublicItem(item),
    outputFile: "ui-libs.json",
  },
  demoIndex: {
    importPathPrefix: "../../../registry/examples",
    items: registryItems.filter(isPublicItem).map((item) => ({ name: item.name })),
  },
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
