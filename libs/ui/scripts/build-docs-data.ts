import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDocsData,
  type CodeBlockLine,
  type ComponentDoc,
  createHookDocLoader,
  DOCS_CODE_THEME_NAME,
  type DocsHighlighter,
  findExamples,
  type HookRegistryItem,
  highlightCode,
  highlightSourceFile,
  kebabToCamelCase,
} from "@diffgazer/registry";
import {
  REGISTRY_ITEM_TYPE,
  type Registry,
  type RegistryItem,
  RegistrySchema,
} from "@diffgazer/registry/schemas";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_PATH = resolve(ROOT, "registry/registry.json");
const PUBLIC_REGISTRY_DIR = resolve(ROOT, "public/r");
const KEYS_PUBLIC_REGISTRY_DIR = resolve(ROOT, "../keys/public/r");
const KEYS_REGISTRY_PREFIXES = ["@diffgazer-keys/", "@diffgazer/keys/"] as const;

function loadRegistryItems(): RegistryItem[] {
  return RegistrySchema.parse(JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"))).items;
}

const registryItems = loadRegistryItems();
const registryItemsByName = new Map(registryItems.map((item) => [item.name, item]));
const loadHookDoc = createHookDocLoader(resolve(ROOT, "registry/hook-docs"), (name) => name);
const COMPONENT_DOCS_DIR = resolve(ROOT, "registry/component-docs");
const GENERATED_COMPONENTS_DIR = resolve(ROOT, "docs/generated/components");
const COMPONENT_DOC_SUPPORT_FILES = new Set(["types.ts"]);
const COMPONENT_DOC_ARRAY_FIELDS = [
  "anatomy",
  "companionExamples",
  "cssVariables",
  "dataAttributes",
  "examples",
  "notes",
  "tags",
] as const;
const COMPONENT_DOC_OBJECT_FIELDS = ["props", "usage"] as const;
const COMPONENT_DOC_FIELDS = [
  "description",
  "keyboard",
  "noProps",
  ...COMPONENT_DOC_ARRAY_FIELDS,
  ...COMPONENT_DOC_OBJECT_FIELDS,
] as const;

function isPublicItem(item: RegistryItem): boolean {
  return item.meta?.hidden !== true;
}

/**
 * Items that ship as installable registry primitives but do not own a
 * standalone docs page. Their docs live on a companion item's page (e.g.
 * horizontal-stepper is documented as a section of the stepper page).
 */
function hasOwnDocsPage(item: RegistryItem): boolean {
  return item.meta?.docsPage !== false;
}

function validateComponentDocOwnership(items: RegistryItem[]): void {
  const itemByName = new Map(items.map((item) => [item.name, item]));
  const invalidDocs = readdirSync(COMPONENT_DOCS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !COMPONENT_DOC_SUPPORT_FILES.has(entry.name),
    )
    .map((entry) => entry.name.slice(0, -3))
    .filter((name) => {
      const item = itemByName.get(name);
      return (
        !item || item.type !== REGISTRY_ITEM_TYPE.ui || !isPublicItem(item) || !hasOwnDocsPage(item)
      );
    });

  if (invalidDocs.length > 0) {
    throw new Error(
      `Component docs must belong to public registry:ui items with their own docs page: ${invalidDocs.join(", ")}`,
    );
  }
}

function mapHookItem(item: RegistryItem): HookRegistryItem {
  return {
    name: item.name,
    registryName: item.name,
    title: item.title ?? item.name,
    description: item.description ?? "",
    files: item.files,
  };
}

validateComponentDocOwnership(registryItems);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return !Array.isArray(value);
}

function isComponentDoc(value: unknown): value is ComponentDoc {
  if (!isRecord(value)) return false;
  if (!COMPONENT_DOC_FIELDS.some((field) => field in value)) return false;
  if ("description" in value && typeof value.description !== "string") return false;
  if ("keyboard" in value && value.keyboard !== null && !isRecord(value.keyboard)) return false;
  if ("noProps" in value && typeof value.noProps !== "boolean") return false;

  for (const field of COMPONENT_DOC_ARRAY_FIELDS) {
    if (field in value && !Array.isArray(value[field])) return false;
  }
  for (const field of COMPONENT_DOC_OBJECT_FIELDS) {
    if (field in value && !isRecord(value[field])) return false;
  }

  return true;
}

async function loadComponentDoc(name: string): Promise<ComponentDoc | null> {
  const docPath = resolve(COMPONENT_DOCS_DIR, `${name}.ts`);
  if (!existsSync(docPath)) return null;

  const exports: unknown = await import(docPath);
  if (!isRecord(exports)) {
    throw new Error(
      `Component "${name}": docs module did not load an export object from ${docPath}`,
    );
  }

  const exportName = `${kebabToCamelCase(name)}Doc`;
  if (!(exportName in exports)) {
    throw new Error(`Component "${name}": expected docs export "${exportName}" in ${docPath}`);
  }

  const doc = exports[exportName];
  if (!isComponentDoc(doc)) {
    throw new Error(`Component "${name}": docs export "${exportName}" is not a ComponentDoc`);
  }

  return doc;
}

interface ComponentCopyArchiveFile {
  path: string;
  type: RegistryItem["files"][number]["type"];
  target: string;
  content: string;
}

export interface ComponentCopyArchive {
  $schema: string;
  name: string;
  type: "registry:item";
  title: string;
  description: string;
  dependencies: string[];
  registryDependencies: [];
  files: ComponentCopyArchiveFile[];
}

export interface UiDocsDataBuildResult {
  hooksCount: number;
  componentsCount: number;
  libsCount: number;
}

function parseBuiltRegistryItem(path: string): RegistryItem {
  const parsed = RegistrySchema.parse({ items: [JSON.parse(readFileSync(path, "utf8"))] });
  const item = parsed.items[0];
  if (!item) throw new Error(`Built registry item is empty: ${path}`);
  return item;
}

function keysDependencyName(dependency: string): string | null {
  for (const prefix of KEYS_REGISTRY_PREFIXES) {
    if (dependency.startsWith(prefix)) return dependency.slice(prefix.length);
  }
  return null;
}

function resolveCopyDependencyClosure(item: RegistryItem): {
  localNames: string[];
  keysNames: string[];
} {
  const localNames: string[] = [];
  const keysNames = new Set<string>();
  const visited = new Set<string>();

  function visit(current: RegistryItem): void {
    if (visited.has(current.name)) return;
    visited.add(current.name);

    for (const dependency of current.registryDependencies ?? []) {
      const keysName = keysDependencyName(dependency);
      if (keysName) {
        keysNames.add(keysName);
        continue;
      }
      if (dependency.startsWith("@")) {
        throw new Error(
          `Component "${item.name}": unsupported registry namespace dependency "${dependency}"`,
        );
      }
      const localDependency = registryItemsByName.get(dependency);
      if (!localDependency) {
        throw new Error(
          `Component "${item.name}": registry dependency "${dependency}" was not found`,
        );
      }
      visit(localDependency);
    }

    localNames.push(current.name);
  }

  visit(item);
  return { localNames, keysNames: [...keysNames].sort() };
}

function copyArchiveTarget(file: RegistryItem["files"][number]): string {
  if (file.path.startsWith("registry/ui/")) return `@ui/${file.path.slice("registry/ui/".length)}`;
  if (file.path.startsWith("registry/hooks/")) {
    return `@hooks/${file.path.slice("registry/hooks/".length)}`;
  }
  if (file.path.startsWith("registry/lib/"))
    return `@lib/${file.path.slice("registry/lib/".length)}`;
  if (file.path.startsWith("src/hooks/")) return `@hooks/${file.path.slice("src/hooks/".length)}`;
  if (file.target?.startsWith("src/hooks/")) {
    return `@hooks/${file.target.slice("src/hooks/".length)}`;
  }
  if (file.target) return file.target;
  if (file.path.startsWith("styles/")) return `~/${file.path}`;
  throw new Error(`Unsupported copy archive path: ${file.path}`);
}

function appendArchiveFiles(
  filesByTarget: Map<string, ComponentCopyArchiveFile>,
  item: RegistryItem,
): void {
  for (const file of item.files) {
    if (typeof file.content !== "string") {
      throw new Error(`Built registry item "${item.name}" is missing content for ${file.path}`);
    }
    const target = copyArchiveTarget(file);
    const existing = filesByTarget.get(target);
    if (existing) {
      if (existing.content !== file.content) {
        throw new Error(`Conflicting copy archive content for ${target}`);
      }
      continue;
    }
    filesByTarget.set(target, { path: file.path, type: file.type, target, content: file.content });
  }
}

export function buildComponentCopyArchive(itemName: string): ComponentCopyArchive {
  const item = registryItemsByName.get(itemName);
  if (!item) throw new Error(`Unknown UI registry item: ${itemName}`);

  const { localNames, keysNames } = resolveCopyDependencyClosure(item);
  const dependencies = new Set<string>();
  const filesByTarget = new Map<string, ComponentCopyArchiveFile>();

  for (const name of localNames) {
    const sourceItem = registryItemsByName.get(name);
    if (!sourceItem) throw new Error(`Unknown UI registry item: ${name}`);
    for (const dependency of sourceItem.dependencies ?? []) dependencies.add(dependency);
    appendArchiveFiles(
      filesByTarget,
      parseBuiltRegistryItem(resolve(PUBLIC_REGISTRY_DIR, `${name}.json`)),
    );
  }

  for (const name of keysNames) {
    const keysItem = parseBuiltRegistryItem(resolve(KEYS_PUBLIC_REGISTRY_DIR, `${name}.json`));
    for (const dependency of keysItem.dependencies ?? []) dependencies.add(dependency);
    appendArchiveFiles(filesByTarget, keysItem);
  }

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: `${item.name}-copy-archive`,
    type: "registry:item",
    title: `${item.title ?? item.name} copy archive`,
    description: `Dependency-closed copy archive for ${item.title ?? item.name}.`,
    dependencies: [...dependencies].sort(),
    registryDependencies: [],
    files: [...filesByTarget.values()],
  };
}

export function buildComponentSourceData(itemName: string, highlighter: DocsHighlighter) {
  const copyArchive = buildComponentCopyArchive(itemName);
  const source = Object.fromEntries(
    copyArchive.files.map((file) => [
      file.target,
      highlightSourceFile(highlighter, file.target, file.content, DOCS_CODE_THEME_NAME),
    ]),
  );

  return { copyArchive, source };
}

function readExamples(
  itemName: string,
  highlighter: DocsHighlighter,
): {
  examples: string[];
  exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }>;
} {
  const examples = findExamples(resolve(ROOT, "registry/examples"), itemName);
  const exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }> = {};

  for (const exampleName of examples) {
    const raw = readFileSync(
      resolve(ROOT, "registry/examples", itemName, `${exampleName}.tsx`),
      "utf-8",
    );
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
  const { copyArchive, source } = buildComponentSourceData(item.name, highlighter);
  const mergedSource = JSON.stringify(copyArchive, null, 2);
  const usageExample = docs?.usage?.example;
  const examplesData = readExamples(item.name, highlighter);
  // Merge companion examples (other items' example folders) into exampleSource
  // so a unified MDX page can render <Example name="..." /> for both primitives.
  // The companion examples are intentionally NOT pushed onto `examples` so
  // `<Examples skipFirst />` consumers stay scoped to the primary item.
  for (const companionName of docs?.companionExamples ?? []) {
    const companionData = readExamples(companionName, highlighter);
    Object.assign(examplesData.exampleSource, companionData.exampleSource);
  }
  const rawSnippet =
    docs?.usage?.code ??
    (usageExample ? examplesData.exampleSource[usageExample]?.raw : undefined) ??
    "";
  const usageSnippet = rawSnippet;
  const keysItems = resolveCopyDependencyClosure(item).keysNames;
  const crossDeps =
    keysItems.length > 0 ? [{ library: "keys", type: "hook", items: keysItems }] : undefined;

  writeFileSync(
    resolve(GENERATED_COMPONENTS_DIR, `${item.name}.source.json`),
    `${JSON.stringify({ source, mergedSource, crossDeps })}\n`,
  );

  return {
    name: item.name,
    title: item.title ?? item.name,
    description: docs?.description ?? item.description ?? "",
    dependencies: copyArchive.dependencies,
    files: copyArchive.files.map((file) => file.target),
    props: docs?.props ?? {},
    usageSnippet,
    usageSnippetHighlighted: usageSnippet
      ? highlightCode(highlighter, usageSnippet, docs?.usage?.lang ?? "tsx", DOCS_CODE_THEME_NAME)
      : [],
    examples: examplesData.examples,
    exampleSource: examplesData.exampleSource,
    docs,
    crossDeps,
  };
}

export function buildUiDocsData(): Promise<UiDocsDataBuildResult> {
  return buildDocsData({
    libraryId: "ui",
    rootDir: ROOT,
    registryPath: REGISTRY_PATH,
    examplesDir: resolve(ROOT, "registry/examples"),
    outputDir: resolve(ROOT, "docs/generated"),
    hooks: {
      contentDir: resolve(ROOT, "docs/content/hooks"),
      filter: (item) =>
        item.type === REGISTRY_ITEM_TYPE.hook && isPublicItem(item) && hasOwnDocsPage(item),
      mapItem: mapHookItem,
      loadHookDoc,
      aggregateHooksFile: "ui-hooks.json",
    },
    components: {
      contentDir: resolve(ROOT, "docs/content/components"),
      filter: (item) =>
        item.type === REGISTRY_ITEM_TYPE.ui && isPublicItem(item) && hasOwnDocsPage(item),
      processComponent,
    },
    libs: {
      filter: (item) => item.type === REGISTRY_ITEM_TYPE.lib && isPublicItem(item),
      outputFile: "ui-libs.json",
    },
    demoIndex: {
      importPathPrefix: "../../../registry/examples",
      items: registryItems.filter(isPublicItem).map((item) => ({ name: item.name })),
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildUiDocsData().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
