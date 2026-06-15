import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "../logger.js";
import { type RegistryFile, RegistryItemSchema } from "../registry-types.js";
import { findExamples } from "./examples.js";
import { type DocsHighlighter, type HighlightLanguage, highlightCode } from "./highlight.js";
import type { CodeBlockLine, EnrichedHookData, HookDoc, HookSourceData } from "./types.js";

export interface HookRegistryItem {
  name: string;
  registryName?: string;
  title?: string;
  description?: string;
  files: Array<{ path: string }>;
}

interface HookSourceFileData {
  path: string;
  raw: string;
  highlighted: CodeBlockLine[];
}

type HookSourceDataWithFiles = HookSourceData & {
  files: HookSourceFileData[];
};

export interface GenerateHooksSourceOptions {
  items: HookRegistryItem[];
  rootDir: string;
  highlighter: DocsHighlighter;
  themeName: string;
  lang?: HighlightLanguage;
}

export interface GenerateEnrichedHookDataOptions extends GenerateHooksSourceOptions {
  loadHookDoc: (hookName: string) => Promise<HookDoc | null>;
  examplesDir?: string;
}

function toConsumerFilePath(path: string): string {
  if (path.startsWith("registry/ui/"))
    return `src/components/ui/${path.slice("registry/ui/".length)}`;
  if (path.startsWith("registry/hooks/"))
    return `src/hooks/${path.slice("registry/hooks/".length)}`;
  if (path.startsWith("registry/lib/")) return `src/lib/${path.slice("registry/lib/".length)}`;
  if (path.startsWith("styles/")) return `src/styles/${path.slice("styles/".length)}`;
  return path;
}

function getDisplayPath(file: RegistryFile): string {
  return file.target ?? toConsumerFilePath(file.path);
}

function readPublicRegistryFiles(options: {
  item: HookRegistryItem;
  rootDir: string;
  highlighter: DocsHighlighter;
  themeName: string;
  lang: HighlightLanguage;
}): HookSourceFileData[] | null {
  const { item, rootDir, highlighter, themeName, lang } = options;
  const publicName = item.registryName ?? item.name;
  const itemPath = resolve(rootDir, "public/r", `${publicName}.json`);
  if (!existsSync(itemPath)) return null;

  const registryItem = RegistryItemSchema.parse(JSON.parse(readFileSync(itemPath, "utf-8")));
  const files = registryItem.files
    .filter((file): file is RegistryFile & { content: string } => typeof file.content === "string")
    .map((file) => ({
      path: getDisplayPath(file),
      raw: file.content,
      highlighted: highlightCode(highlighter, file.content, lang, themeName),
    }));

  return files.length > 0 ? files : null;
}

function readSourceFile(options: {
  item: HookRegistryItem;
  rootDir: string;
  highlighter: DocsHighlighter;
  themeName: string;
  lang: HighlightLanguage;
}): HookSourceFileData | null {
  const { item, rootDir, highlighter, themeName, lang } = options;
  const file = item.files[0];
  if (!file?.path) {
    log.warn(`Hook "${item.name}": no file path, skipping`);
    return null;
  }
  const hookPath = resolve(rootDir, file.path);
  if (!existsSync(hookPath)) {
    log.warn(`Hook "${item.name}": file not found at ${hookPath}, skipping`);
    return null;
  }

  const raw = readFileSync(hookPath, "utf-8");
  return {
    path: file.path,
    raw,
    highlighted: highlightCode(highlighter, raw, lang, themeName),
  };
}

export function generateHooksSource(
  options: GenerateHooksSourceOptions,
): Record<string, HookSourceData> {
  const { items, rootDir, highlighter, themeName, lang = "typescript" } = options;
  const data: Record<string, HookSourceData> = {};

  for (const item of items) {
    const files =
      readPublicRegistryFiles({ item, rootDir, highlighter, themeName, lang }) ??
      [readSourceFile({ item, rootDir, highlighter, themeName, lang })].filter(
        (file): file is HookSourceFileData => file !== null,
      );
    const firstFile = files[0];
    if (!firstFile) continue;

    const entry: HookSourceDataWithFiles = {
      name: item.name,
      title: item.title ?? item.name,
      description: item.description ?? "",
      source: {
        raw: firstFile.raw,
        highlighted: firstFile.highlighted,
      },
      files,
    };
    data[item.name] = entry;
  }

  return data;
}

export async function generateEnrichedHookData(
  options: GenerateEnrichedHookDataOptions,
): Promise<Record<string, EnrichedHookData>> {
  const {
    items,
    rootDir,
    highlighter,
    themeName,
    lang = "typescript",
    loadHookDoc,
    examplesDir,
  } = options;

  const data: Record<string, EnrichedHookData> = {};

  for (const item of items) {
    const file = item.files[0];
    if (!file?.path) {
      log.warn(`Hook "${item.name}": no file path, skipping`);
      continue;
    }
    const hookPath = resolve(rootDir, file.path);
    if (!existsSync(hookPath)) {
      log.warn(`Hook "${item.name}": file not found at ${hookPath}, skipping`);
      continue;
    }

    const raw = readFileSync(hookPath, "utf-8");
    const highlighted = highlightCode(highlighter, raw, lang, themeName);

    const docs = await loadHookDoc(item.name);

    let usageSnippet: string | undefined;
    let usageSnippetHighlighted: CodeBlockLine[] | undefined;
    if (docs?.usage?.code) {
      usageSnippet = docs.usage.code;
      const usageLang = docs.usage.lang ?? "tsx";
      usageSnippetHighlighted = highlightCode(highlighter, docs.usage.code, usageLang, themeName);
    } else if (docs?.usage?.example && examplesDir) {
      const exampleFile = findExampleFile(examplesDir, item.name, docs.usage.example);
      if (exampleFile) {
        usageSnippet = readFileSync(exampleFile, "utf-8");
        usageSnippetHighlighted = highlightCode(highlighter, usageSnippet, "tsx", themeName);
      }
    }

    const examples: string[] = [];
    const exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }> = {};

    if (examplesDir) {
      const exampleNames = findExamples(examplesDir, item.name);
      const hookExamplesDir = resolve(examplesDir, item.name);

      for (const exampleName of exampleNames) {
        const examplePath = resolve(hookExamplesDir, `${exampleName}.tsx`);
        const exampleRaw = readFileSync(examplePath, "utf-8");

        examples.push(exampleName);
        exampleSource[exampleName] = {
          raw: exampleRaw,
          highlighted: highlightCode(highlighter, exampleRaw, "tsx", themeName),
        };
      }
    }

    data[item.name] = {
      name: item.name,
      title: item.title ?? item.name,
      description: docs?.description ?? item.description ?? "",
      source: { raw, highlighted },
      docs,
      usageSnippet,
      usageSnippetHighlighted,
      examples,
      exampleSource,
      parameters: docs?.parameters,
      returns: docs?.returns,
    };
  }

  return data;
}

function findExampleFile(
  examplesDir: string,
  hookName: string,
  exampleName: string,
): string | null {
  const hookDir = resolve(examplesDir, hookName);
  if (!existsSync(hookDir)) return null;

  for (const ext of [".tsx", ".ts"]) {
    const filePath = resolve(hookDir, `${exampleName}${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}
