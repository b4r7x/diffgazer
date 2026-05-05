import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findExamples } from "./examples.js";
import { highlightCode, type DocsHighlighter, type HighlightLanguage } from "./highlight.js";
import type {
  CodeBlockLine,
  HookSourceData,
  EnrichedHookData,
  HookDoc,
} from "./types.js";
import type { Logger } from "../logger.js";

export interface HookRegistryItem {
  name: string;
  title?: string;
  description?: string;
  files: Array<{ path: string }>;
}

export interface GenerateHooksSourceOptions {
  items: HookRegistryItem[];
  rootDir: string;
  highlighter: DocsHighlighter;
  themeName: string;
  lang?: HighlightLanguage;
  logger?: Logger;
}

export interface GenerateEnrichedHookDataOptions extends GenerateHooksSourceOptions {
  loadHookDoc: (hookName: string) => Promise<HookDoc | null>;
  examplesDir?: string;
}

export function generateHooksSource(
  options: GenerateHooksSourceOptions
): Record<string, HookSourceData> {
  const { items, rootDir, highlighter, themeName, lang = "typescript", logger } = options;
  const data: Record<string, HookSourceData> = {};

  for (const item of items) {
    const file = item.files[0];
    if (!file?.path) {
      logger?.warn?.(`Hook "${item.name}": no file path, skipping`);
      continue;
    }
    const hookPath = resolve(rootDir, file.path);
    if (!existsSync(hookPath)) {
      logger?.warn?.(`Hook "${item.name}": file not found at ${hookPath}, skipping`);
      continue;
    }

    const raw = readFileSync(hookPath, "utf-8");
    data[item.name] = {
      name: item.name,
      title: item.title ?? item.name,
      description: item.description ?? "",
      source: {
        raw,
        highlighted: highlightCode(highlighter, raw, lang, themeName),
      },
    };
  }

  return data;
}

export async function generateEnrichedHookData(
  options: GenerateEnrichedHookDataOptions
): Promise<Record<string, EnrichedHookData>> {
  const {
    items,
    rootDir,
    highlighter,
    themeName,
    lang = "typescript",
    loadHookDoc,
    examplesDir,
    logger,
  } = options;

  const data: Record<string, EnrichedHookData> = {};

  for (const item of items) {
    const file = item.files[0];
    if (!file?.path) {
      logger?.warn?.(`Hook "${item.name}": no file path, skipping`);
      continue;
    }
    const hookPath = resolve(rootDir, file.path);
    if (!existsSync(hookPath)) {
      logger?.warn?.(`Hook "${item.name}": file not found at ${hookPath}, skipping`);
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
  exampleName: string
): string | null {
  const hookDir = resolve(examplesDir, hookName);
  if (!existsSync(hookDir)) return null;

  for (const ext of [".tsx", ".ts"]) {
    const filePath = resolve(hookDir, `${exampleName}${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}
