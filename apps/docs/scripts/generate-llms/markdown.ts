import { existsSync, readFileSync } from "node:fs";
import type { PreRenderPage } from "../generate-sitemap.ts";
import {
  type PreparedComponentScaffold,
  type PreparedExample,
  type PreparedHookScaffold,
  type PreparedInstallation,
  type PreparedScaffoldData,
  type PreparedSourceFile,
} from "../../src/lib/scaffold-data.ts";
import { loadPreparedScaffoldData } from "./artifacts.ts";

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

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function markdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const header = `| ${headers.map(escapeTableCell).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${row.map((cell) => escapeTableCell(cell)).join(" | ")} |`)
    .join("\n");
  return `${header}\n${divider}\n${body}`;
}

function codeBlock(code: string, language: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(code.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}${language}\n${code.trimEnd()}\n${fence}`;
}

function sourceLanguage(path: string): string {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".tsx")) return "tsx";
  return "typescript";
}

function renderInstallation(installation: PreparedInstallation): string {
  const paths = installation.paths.map((path) => {
    const details = path.details.map((detail) => `- **${detail.label}:** \`${detail.value}\``);
    const parts = [
      `### ${path.label}`,
      path.available ? "Available." : "Not currently available.",
      path.command ? codeBlock(path.command, "bash") : "",
      details.join("\n"),
      path.note ?? "",
    ];
    return parts.filter(Boolean).join("\n\n");
  });
  if (installation.note) paths.push(installation.note);
  return paths.join("\n\n");
}

function renderExample(example: PreparedExample): string {
  const source = example.raw ? codeBlock(example.raw, "tsx") : `Example id: \`${example.name}\`.`;
  return `### ${example.title}\n\n${source}`;
}

function renderExamples(examples: PreparedExample[]): string {
  return examples.map(renderExample).join("\n\n");
}

function renderSource(sourceFiles: PreparedSourceFile[]): string {
  return sourceFiles
    .map((file) => {
      if (!file.raw) return `- \`${file.path}\``;
      return `### \`${file.path}\`\n\n${codeBlock(file.raw, sourceLanguage(file.path))}`;
    })
    .join("\n\n");
}

function renderComponentApi(data: PreparedComponentScaffold): string {
  const sections: string[] = [];
  for (const [component, props] of Object.entries(data.props)) {
    const rows = Object.entries(props).map(([name, prop]) => [
      name,
      prop.type,
      prop.required ? "Yes" : "No",
      prop.defaultValue ?? "—",
      prop.description,
    ]);
    if (rows.length > 0) {
      sections.push(
        `### ${component}\n\n${markdownTable(
          ["Prop", "Type", "Required", "Default", "Description"],
          rows,
        )}`,
      );
    }
  }

  if (data.dataAttributes.length > 0) {
    sections.push(
      `### Data attributes\n\n${markdownTable(
        ["Attribute", "Applies to", "Values", "Description"],
        data.dataAttributes.map((item) => [
          item.attribute,
          item.appliesTo,
          item.values,
          item.description,
        ]),
      )}`,
    );
  }
  if (data.cssVariables.length > 0) {
    sections.push(
      `### CSS variables\n\n${markdownTable(
        ["Name", "Default", "Description"],
        data.cssVariables.map((item) => [
          item.name,
          item.defaultValue ?? "component-defined",
          item.description,
        ]),
      )}`,
    );
  }
  return sections.join("\n\n");
}

function renderAccessibility(data: PreparedComponentScaffold): string {
  const sections: string[] = [];
  const keyboard = data.keyboard;
  if (keyboard) {
    const keyboardParts = ["### Keyboard Navigation", keyboard.description];
    if (keyboard.keys && keyboard.keys.length > 0) {
      keyboardParts.push(
        markdownTable(
          ["Key", "Action"],
          keyboard.keys.map((row) => [row.keys, row.action]),
        ),
      );
    }
    if (keyboard.examples.length > 0) {
      keyboardParts.push(
        keyboard.examples
          .map((example) => `- **${example.title}** (\`${example.name}\`)`)
          .join("\n"),
      );
    }
    sections.push(keyboardParts.filter(Boolean).join("\n\n"));
  }
  if (data.accessibilityNotes.length > 0) {
    sections.push(
      `### Notes\n\n${data.accessibilityNotes
        .map((note) => `#### ${note.title}\n\n${note.content}`)
        .join("\n\n")}`,
    );
  }
  return sections.join("\n\n");
}

function renderParameters(data: PreparedHookScaffold): string {
  return markdownTable(
    ["Parameter", "Type", "Required", "Default", "Description"],
    data.parameters.map((parameter) => [
      parameter.name,
      parameter.type,
      parameter.required ? "Yes" : "No",
      parameter.defaultValue ?? "—",
      parameter.description,
    ]),
  );
}

function renderReturns(data: PreparedHookScaffold): string {
  if (!data.returns) return "";
  const parts = [`**Type:** \`${data.returns.type}\``, data.returns.description];
  if (data.returns.properties && data.returns.properties.length > 0) {
    parts.push(
      markdownTable(
        ["Property", "Type", "Required", "Default", "Description"],
        data.returns.properties.map((property) => [
          property.name,
          property.type,
          property.required ? "Yes" : "No",
          property.defaultValue ?? "—",
          property.description,
        ]),
      ),
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

function renderNotes(data: PreparedHookScaffold): string {
  return data.notes.map((note) => `### ${note.title}\n\n${note.content}`).join("\n\n");
}

function renderComponentScaffold(data: PreparedComponentScaffold, hero?: string): string {
  const heroExample = hero ? data.examples.find((example) => example.name === hero) : undefined;
  const examples = heroExample
    ? data.examples.filter((example) => example.name !== heroExample.name)
    : data.examples;
  const api = renderComponentApi(data);
  const accessibility = renderAccessibility(data);
  const sections = [
    heroExample ? `## Example\n\n${renderExample(heroExample)}` : "",
    `## Installation\n\n${renderInstallation(data.installation)}`,
    data.usage ? `## Usage\n\n${codeBlock(data.usage.code, data.usage.lang)}` : "",
    examples.length > 0 ? `## Examples\n\n${renderExamples(examples)}` : "",
    api ? `## API Reference\n\n${api}` : "",
    accessibility ? `## Accessibility\n\n${accessibility}` : "",
    data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "",
  ];
  return sections.filter(Boolean).join("\n\n");
}

function renderHookScaffold(data: PreparedHookScaffold): string {
  const sections = [
    data.usage ? `## Usage\n\n${codeBlock(data.usage.code, data.usage.lang)}` : "",
    `## Installation\n\n${renderInstallation(data.installation)}`,
    data.parameters.length > 0 ? `## Parameters\n\n${renderParameters(data)}` : "",
    data.returns ? `## Returns\n\n${renderReturns(data)}` : "",
    data.examples.length > 0 ? `## Examples\n\n${renderExamples(data.examples)}` : "",
    data.notes.length > 0 ? `## Notes\n\n${renderNotes(data)}` : "",
    data.sourceFiles.length > 0 ? `## Source\n\n${renderSource(data.sourceFiles)}` : "",
  ];
  return sections.filter(Boolean).join("\n\n");
}

function quotedAttribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}=(['"])(.*?)\\1`).exec(attributes);
  return match?.[2];
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
      const example = name ? data.examples.find((item) => item.name === name) : undefined;
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
    const examples = /\bskipFirst\b/.test(attributes) ? data.examples.slice(1) : data.examples;
    const body = renderExamples(examples);
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
