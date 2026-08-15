import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PreparedScaffoldData } from "../../src/lib/scaffold-data.ts";
import type { PreRenderPage } from "../generate-sitemap.ts";
import { DOCS_ROOT, loadPreparedScaffoldData } from "./artifacts.ts";
import { codeBlock } from "./markdown-primitives.ts";
import {
  renderAccessibility,
  renderComponentApi,
  renderComponentScaffold,
  renderExample,
  renderExamples,
  renderHookScaffold,
  renderInstallation,
  renderNotes,
  renderParameters,
  renderReturns,
  renderSource,
  resolveExampleByName,
  withoutHero,
} from "./scaffold-markdown.ts";

export interface PageMarkdown {
  path: string;
  title: string;
  description: string;
  markdown: string;
}

interface Frontmatter {
  title?: string;
  description?: string;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(source: string): { frontmatter: Frontmatter; body: string } {
  if (!source.startsWith("---")) return { frontmatter: {}, body: source };

  const end = source.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: source };

  const frontmatter: Frontmatter = {};
  for (const line of source.slice(3, end).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2] ?? "";
    if (key === "title" || key === "description") {
      frontmatter[key] = stripQuotes(rawValue.trim());
    }
  }

  return {
    frontmatter,
    body: source.slice(end + "\n---".length).replace(/^\r?\n/, ""),
  };
}

const HERO_ATTRIBUTE = /\bhero=(['"])(.*?)\1/;
const NAME_ATTRIBUTE = /\bname=(['"])(.*?)\1/;
const LIBRARY_ATTRIBUTE = /\blibrary=(['"])(.*?)\1/;
const SECTION_TITLE_ATTRIBUTE = /\bsectionTitle=(['"])(.*?)\1/;

function quotedAttribute(attributes: string, pattern: RegExp): string | undefined {
  return pattern.exec(attributes)?.[2];
}

function jsxFragmentText(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}=\\{<>((?:[^<]|</>)*)</>\\}`).exec(attributes);
  return match?.[1]?.trim();
}

function mapOutsideFencedBlocks(
  source: string,
  mapLine: (line: string, inFence: boolean) => string,
): string {
  const lines = source.split(/\r?\n/);
  let inFence = false;

  return lines
    .map((line) => {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
        return line;
      }
      return mapLine(line, inFence);
    })
    .join("\n");
}

function replaceOutsideInlineCode(
  line: string,
  pattern: RegExp,
  replacer: (match: string) => string,
): string {
  let result = "";
  let index = 0;

  while (index < line.length) {
    const tick = line.indexOf("`", index);
    if (tick === -1) {
      result += line.slice(index).replace(pattern, replacer);
      break;
    }

    result += line.slice(index, tick).replace(pattern, replacer);
    const close = line.indexOf("`", tick + 1);
    if (close === -1) {
      result += line.slice(tick);
      break;
    }

    result += line.slice(tick, close + 1);
    index = close + 1;
  }

  return result;
}

function findSelfClosingJsxEnd(source: string, start: number): number | null {
  if (source[start] !== "<" || !/[A-Z]/.test(source[start + 1] ?? "")) return null;

  let index = start + 1;
  let braceDepth = 0;
  let inString: '"' | "'" | null = null;

  while (index < source.length - 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inString) {
      if (char === inString && source[index - 1] !== "\\") inString = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      index += 1;
      continue;
    }

    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === "/" && next === ">" && braceDepth === 0) return index + 2;

    index += 1;
  }

  return null;
}

function replaceSelfClosingComponents(source: string, replace: (match: string) => string): string {
  return mapOutsideFencedBlocks(source, (line, inFence) => {
    if (inFence) return line;

    let result = "";
    let index = 0;

    while (index < line.length) {
      const tick = line.indexOf("`", index);
      const tag = line.indexOf("<", index);
      if (tag === -1) {
        result += line.slice(index);
        break;
      }

      if (tick !== -1 && tick < tag) {
        const close = line.indexOf("`", tick + 1);
        if (close === -1) {
          result += line.slice(index);
          break;
        }
        result += line.slice(index, close + 1);
        index = close + 1;
        continue;
      }

      result += line.slice(index, tag);
      const end = findSelfClosingJsxEnd(line, tag);
      if (end === null) {
        result += line[tag];
        index = tag + 1;
        continue;
      }

      const match = line.slice(tag, end);
      result += /^<[A-Z]/.test(match) ? replace(match) : match;
      index = end;
    }

    return result;
  });
}

interface LibraryHookEntry {
  title: string;
  description: string;
  files?: Array<{ path: string; raw: string }>;
}

function loadLibraryHooksMap(library: string): Record<string, LibraryHookEntry> | null {
  const path = resolve(DOCS_ROOT, `src/generated/${library}/${library}-hooks.json`);
  if (!existsSync(path)) return null;

  return JSON.parse(readFileSync(path, "utf8")) as Record<string, LibraryHookEntry>;
}

function renderLibraryHookSource(attributes: string): string {
  const library = quotedAttribute(attributes, LIBRARY_ATTRIBUTE);
  const sectionTitle = quotedAttribute(attributes, SECTION_TITLE_ATTRIBUTE);
  const hint = jsxFragmentText(attributes, "hint");
  if (!library || !sectionTitle) return "";

  const hooks = loadLibraryHooksMap(library);
  const sections = [sectionTitle ? `## ${sectionTitle}` : "", hint ?? ""];
  if (hooks) {
    for (const hook of Object.values(hooks)) {
      const files = hook.files?.filter((file) => file.raw) ?? [];
      sections.push(
        files.length > 0
          ? `### ${hook.title}\n\n${hook.description}\n\n${renderSource(files)}`
          : `### ${hook.title}\n\n${hook.description}`,
      );
    }
  }

  return sections.filter(Boolean).join("\n\n");
}

function renderPreparedMdx(source: string, data: PreparedScaffoldData | null): string {
  let rendered = source;

  rendered = replaceSelfClosingComponents(rendered, (match) => {
    if (match.startsWith("<LibraryHookSource")) {
      return renderLibraryHookSource(match);
    }
    return match;
  });

  if (!data) return rendered;

  if (data.type === "component") {
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (!match.startsWith("<ComponentDocScaffold")) return match;
      const attributes = match.slice("<ComponentDocScaffold".length, -2);
      return renderComponentScaffold(data, quotedAttribute(attributes, HERO_ATTRIBUTE));
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (!match.startsWith("<Example")) return match;
      const attributes = match.slice("<Example".length, -2);
      const name = quotedAttribute(attributes, NAME_ATTRIBUTE);
      const example = name ? resolveExampleByName(data, name) : undefined;
      return example ? renderExample(example) : "";
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<APIReference />") return match;
      const api = renderComponentApi(data);
      return api ? `## API Reference\n\n${api}` : "";
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<KeyboardNav />") return match;
      if (!data.keyboard) return "";
      return renderAccessibility({ ...data, accessibilityNotes: [] });
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<AccessibilityNotes />") return match;
      if (data.accessibilityNotes.length === 0) return "";
      return renderAccessibility({ ...data, keyboard: null });
    });
  } else {
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<HookDocScaffold />") return match;
      return renderHookScaffold(data);
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<ParameterTable />") return match;
      return renderParameters(data);
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<ReturnsTable />") return match;
      return renderReturns(data);
    });
    rendered = replaceSelfClosingComponents(rendered, (match) => {
      if (match !== "<Notes />") return match;
      return renderNotes(data);
    });
  }

  rendered = replaceSelfClosingComponents(rendered, (match) => {
    if (match !== "<UsageSnippet />") return match;
    return data.usage ? codeBlock(data.usage.code, data.usage.lang) : "";
  });
  rendered = replaceSelfClosingComponents(rendered, (match) => {
    if (match !== "<ConsumptionBlock />") return match;
    return renderInstallation(data.installation);
  });
  rendered = replaceSelfClosingComponents(rendered, (match) => {
    if (!match.startsWith("<Examples")) return match;
    const attributes = match.slice("<Examples".length, -2);
    const body = renderExamples(
      withoutHero(data.examples, quotedAttribute(attributes, HERO_ATTRIBUTE)),
    );
    if (!body) return "";
    return /\bshowHeading\b/.test(attributes) ? `## Examples\n\n${body}` : body;
  });
  rendered = replaceSelfClosingComponents(rendered, (match) => {
    if (match !== "<SourceViewer />") return match;
    return data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "";
  });

  return rendered;
}

function renderSteps(source: string): string {
  const lines = source.split(/\r?\n/);
  const rendered: string[] = [];
  let inFence = false;
  let stepIndex: number | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      rendered.push(line);
      continue;
    }
    if (inFence) {
      rendered.push(line);
      continue;
    }

    if (/^\s*<Steps>\s*$/.test(line)) {
      stepIndex = 0;
      continue;
    }
    if (/^\s*<\/Steps>\s*$/.test(line)) {
      stepIndex = null;
      continue;
    }
    const step = /^\s*<Step\s+title=(['"])(.*?)\1\s*>\s*$/.exec(line);
    if (step && stepIndex !== null) {
      stepIndex += 1;
      rendered.push(`### ${String(stepIndex).padStart(2, "0")}. ${step[2] ?? "Step"}`);
      continue;
    }
    if (stepIndex !== null && /^\s*<\/Step>\s*$/.test(line)) continue;
    rendered.push(line);
  }

  return rendered.join("\n");
}

function isBalancedJsxExpression(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function isSelfClosingJsxLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("<") &&
    trimmed.endsWith("/>") &&
    /^<[A-Z]/.test(trimmed) &&
    isBalancedJsxExpression(trimmed)
  );
}

function stripInlineJsxTags(line: string): string {
  return replaceOutsideInlineCode(line, /<\/?[A-Z][A-Za-z0-9.]*\b[^>]*>/g, () => "");
}

function stripMdxSyntax(source: string): string {
  const lines = source.split(/\r?\n/);
  const result: string[] = [];
  let inFence = false;
  let skippingImport = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      result.push(line);
      continue;
    }

    if (!inFence) {
      if (skippingImport) {
        if (line.includes(";")) skippingImport = false;
        continue;
      }

      if (/^(import|export)\b/.test(line)) {
        if (!line.includes(";")) skippingImport = true;
        continue;
      }

      if (isSelfClosingJsxLine(line)) {
        continue;
      }

      if (/^\s*<\/?[A-Z][A-Za-z0-9.]*\b[^>]*>\s*$/.test(line)) {
        continue;
      }

      result.push(stripInlineJsxTags(line));
      continue;
    }

    result.push(line);
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sourceToMarkdown(
  source: string,
  fallbackTitle: string,
  preparedData: PreparedScaffoldData | null = null,
): PageMarkdown["markdown"] {
  const { frontmatter, body } = parseFrontmatter(source);
  const title = frontmatter.title ?? fallbackTitle;
  const description = frontmatter.description ?? "";
  const cleanedBody = stripMdxSyntax(renderSteps(renderPreparedMdx(body, preparedData)));
  const descriptionBlock = description ? `\n\n> ${description}` : "";
  const bodyBlock = cleanedBody ? `\n\n${cleanedBody}` : "";

  return `# ${title}${descriptionBlock}${bodyBlock}\n`;
}

function titleFromPath(path: string): string {
  const segment = path.split("/").filter(Boolean).at(-1) ?? "Home";
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function pageMarkdownFromSource(page: PreRenderPage): PageMarkdown | null {
  if (!page.source || !existsSync(page.source)) return null;

  const source = readFileSync(page.source, "utf-8");
  const { frontmatter } = parseFrontmatter(source);
  const title = frontmatter.title ?? titleFromPath(page.path);
  const description = frontmatter.description ?? "";

  return {
    path: page.path,
    title,
    description,
    markdown: sourceToMarkdown(source, title, loadPreparedScaffoldData(page.path)),
  };
}

function sectionTitle(path: string): string {
  const section = path.split("/").filter(Boolean)[0];
  if (section === "app") return "Diffgazer app";
  if (section === "ui") return "@diffgazer/ui";
  if (section === "keys") return "@diffgazer/keys";
  return "Legal";
}

function markdownUrl(origin: string, path: string): string {
  return `${origin}${path}.md`;
}

export function buildLlmsTxt(pages: PageMarkdown[], origin: string): string {
  const groups = new Map<string, PageMarkdown[]>();
  for (const page of pages) {
    const title = sectionTitle(page.path);
    groups.set(title, [...(groups.get(title) ?? []), page]);
  }

  const sections = [...groups.entries()]
    .map(([title, groupPages]) => {
      const links = groupPages
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((page) => {
          const suffix = page.description ? `: ${page.description}` : "";
          return `- [${page.title}](${markdownUrl(origin, page.path)})${suffix}`;
        })
        .join("\n");
      return `## ${title}\n\n${links}`;
    })
    .join("\n\n");

  return `# Diffgazer documentation\n\n> Local-first AI code review docs for the app, UI registry, and keyboard library.\n\n${sections}\n`;
}
