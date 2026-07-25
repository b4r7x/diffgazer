import { existsSync, readFileSync } from "node:fs";
import type { PreparedScaffoldData } from "../../src/lib/scaffold-data.ts";
import type { PreRenderPage } from "../generate-sitemap.ts";
import { loadPreparedScaffoldData } from "./artifacts.ts";
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

const attributePatterns = new Map<string, RegExp>();

function quotedAttribute(attributes: string, name: string): string | undefined {
  let pattern = attributePatterns.get(name);
  if (!pattern) {
    pattern = new RegExp(`\\b${name}=(['"])(.*?)\\1`);
    attributePatterns.set(name, pattern);
  }
  return pattern.exec(attributes)?.[2];
}

function renderPreparedMdx(source: string, data: PreparedScaffoldData | null): string {
  if (!data) return source;

  let rendered = source;
  if (data.type === "component") {
    rendered = rendered.replace(
      /<ComponentDocScaffold\b([^>]*)\/>/g,
      (_match, attributes: string) =>
        renderComponentScaffold(data, quotedAttribute(attributes, "hero")),
    );
    rendered = rendered.replace(/<Example\b([^>]*)\/>/g, (_match, attributes: string) => {
      const name = quotedAttribute(attributes, "name");
      const example = name ? resolveExampleByName(data, name) : undefined;
      return example ? renderExample(example) : "";
    });
    rendered = rendered.replace(/<APIReference\s*\/>/g, () => {
      const api = renderComponentApi(data);
      return api ? `## API Reference\n\n${api}` : "";
    });
    rendered = rendered.replace(/<KeyboardNav\s*\/>/g, () => {
      if (!data.keyboard) return "";
      return renderAccessibility({ ...data, accessibilityNotes: [] });
    });
    rendered = rendered.replace(/<AccessibilityNotes\s*\/>/g, () => {
      if (data.accessibilityNotes.length === 0) return "";
      return renderAccessibility({ ...data, keyboard: null });
    });
  } else {
    rendered = rendered.replace(/<HookDocScaffold\s*\/>/g, () => renderHookScaffold(data));
    rendered = rendered.replace(/<ParameterTable\s*\/>/g, () => renderParameters(data));
    rendered = rendered.replace(/<ReturnsTable\s*\/>/g, () => renderReturns(data));
    rendered = rendered.replace(/<Notes\s*\/>/g, () => renderNotes(data));
  }

  rendered = rendered.replace(/<UsageSnippet\s*\/>/g, () =>
    data.usage ? codeBlock(data.usage.code, data.usage.lang) : "",
  );
  rendered = rendered.replace(/<ConsumptionBlock\s*\/>/g, () =>
    renderInstallation(data.installation),
  );
  rendered = rendered.replace(/<Examples\b([^>]*)\/>/g, (_match, attributes: string) => {
    const body = renderExamples(withoutHero(data.examples, quotedAttribute(attributes, "hero")));
    if (!body) return "";
    return /\bshowHeading\b/.test(attributes) ? `## Examples\n\n${body}` : body;
  });
  rendered = rendered.replace(/<SourceViewer\s*\/>/g, () =>
    data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "",
  );
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

      if (/^\s*<\/?[A-Z][A-Za-z0-9.]*\b[^>]*>\s*$/.test(line)) {
        continue;
      }

      result.push(line.replace(/<\/?[A-Z][A-Za-z0-9.]*\b[^>]*>/g, ""));
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
