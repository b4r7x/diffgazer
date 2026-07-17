import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { HookPageData } from "../src/lib/generated-doc-data.ts";
import {
  type PreparedComponentScaffold,
  type PreparedExample,
  type PreparedHookScaffold,
  type PreparedInstallation,
  type PreparedScaffoldData,
  type PreparedSourceFile,
  prepareComponentScaffoldData,
  prepareHookScaffoldData,
} from "../src/lib/scaffold-data.ts";
import type { ComponentPageData } from "../src/types/data.ts";
import {
  getPreRenderPages,
  type PreRenderPage,
  resolveGeneratorOutputDir,
  resolveOrigin,
  writeSitemap,
} from "./generate-sitemap.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");

interface PageMarkdown {
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

const codeTokenSchema = z
  .object({
    text: z.string(),
    color: z.string().optional(),
    className: z.string().optional(),
  })
  .strict();

const codeLineSchema = z
  .object({
    number: z.number().finite(),
    content: z.array(codeTokenSchema),
    state: z.enum(["highlight", "added", "removed"]).optional(),
  })
  .strict();

const sourceFileSchema = z
  .object({
    raw: z.string(),
    highlighted: z.array(codeLineSchema),
  })
  .strict();

const sourceFileWithPathSchema = sourceFileSchema.extend({ path: z.string().min(1) }).strict();

const exampleRefSchema = z.object({ name: z.string(), title: z.string() }).strict();
const noteSchema = z.object({ title: z.string(), content: z.string() }).strict();
const usageSchema = z
  .object({
    code: z.string().optional(),
    example: z.string().optional(),
    lang: z.enum(["tsx", "typescript", "css", "bash", "json", "html"]).optional(),
  })
  .strict();
const hookParameterSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
    defaultValue: z.string().optional(),
  })
  .strict();
const hookReturnSchema = z
  .object({
    type: z.string(),
    description: z.string(),
    properties: z.array(hookParameterSchema).optional(),
  })
  .strict();
const hookDocsSchema = z
  .object({
    description: z.string().optional(),
    usage: usageSchema.optional(),
    parameters: z.array(hookParameterSchema).optional(),
    returns: hookReturnSchema.optional(),
    notes: z.array(noteSchema).optional(),
    examples: z.array(exampleRefSchema).optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();
const hookPageDataSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string(),
    docs: hookDocsSchema.nullable(),
    usageSnippet: z.string().optional(),
    usageSnippetHighlighted: z.array(codeLineSchema).optional(),
    examples: z.array(z.string()),
    exampleSource: z.record(z.string(), sourceFileSchema),
    parameters: z.array(hookParameterSchema).optional(),
    returns: hookReturnSchema.optional(),
    files: z.array(z.string().min(1)).optional(),
  })
  .strict();

const componentPropSchema = z
  .object({
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
    description: z.string(),
  })
  .strict();
const componentDocsSchema = z
  .object({
    description: z.string().optional(),
    usage: usageSchema.optional(),
    notes: z.array(noteSchema).optional(),
    examples: z.array(exampleRefSchema).optional(),
    anatomy: z
      .array(
        z
          .object({ name: z.string(), indent: z.number().int(), note: z.string().optional() })
          .strict(),
      )
      .optional(),
    keyboard: z
      .object({
        description: z.string(),
        keys: z.array(z.object({ keys: z.string(), action: z.string() }).strict()).optional(),
        examples: z.array(exampleRefSchema),
      })
      .strict()
      .nullable()
      .optional(),
    dataAttributes: z
      .array(
        z
          .object({
            attribute: z.string(),
            appliesTo: z.string(),
            values: z.string(),
            description: z.string(),
          })
          .strict(),
      )
      .optional(),
    cssVariables: z
      .array(
        z
          .object({
            name: z.string(),
            description: z.string(),
            defaultValue: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    tags: z.array(z.string()).optional(),
    props: z.record(z.string(), z.record(z.string(), componentPropSchema)).optional(),
    companionExamples: z.array(z.string()).optional(),
    noProps: z.boolean().optional(),
  })
  .strict();
const crossDependencySchema = z
  .object({
    library: z.string(),
    type: z.string(),
    items: z.array(z.string()),
  })
  .strict();
const componentPageDataSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string(),
    dependencies: z.array(z.string()),
    files: z.array(z.string().min(1)),
    props: z.record(z.string(), z.record(z.string(), componentPropSchema)),
    usageSnippet: z.string(),
    usageSnippetHighlighted: z.array(codeLineSchema),
    examples: z.array(z.string()),
    exampleSource: z.record(z.string(), sourceFileSchema),
    docs: componentDocsSchema.nullable(),
    crossDeps: z.array(crossDependencySchema).optional(),
  })
  .strict();

const componentSourceArchiveSchema = z
  .object({
    source: z
      .record(z.string().min(1), sourceFileSchema)
      .refine((source) => Object.keys(source).length > 0, "source archive must not be empty"),
    mergedSource: z.string(),
    crossDeps: z.array(crossDependencySchema).optional(),
  })
  .strict();
const hookSourceArchiveSchema = z
  .object({
    source: sourceFileSchema,
    files: z.array(sourceFileWithPathSchema).optional(),
  })
  .strict();

function parseArtifact<T>(path: string, value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid generated docs data: ${path}: ${result.error.message}`);
  }
  return result.data;
}

function readJsonArtifact(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid generated docs data: ${path}: ${detail}`);
  }
}

export function parseScaffoldPageArtifact(
  type: "components" | "hooks",
  value: unknown,
  artifactPath: string,
): ComponentPageData | HookPageData {
  if (type === "components") {
    return parseArtifact(artifactPath, value, componentPageDataSchema) as ComponentPageData;
  }
  return parseArtifact(artifactPath, value, hookPageDataSchema) as HookPageData;
}

export function parseScaffoldSourceArtifact(
  type: "components" | "hooks",
  value: unknown,
  artifactPath: string,
): PreparedSourceFile[] {
  if (type === "components") {
    const archive = parseArtifact(artifactPath, value, componentSourceArchiveSchema);
    return Object.entries(archive.source).map(([path, source]) => ({ path, raw: source.raw }));
  }

  const archive = parseArtifact(artifactPath, value, hookSourceArchiveSchema);
  return (archive.files ?? []).map((file) => ({ path: file.path, raw: file.raw }));
}

function readPreparedSourceFiles(
  library: "keys" | "ui",
  type: "components" | "hooks",
  name: string,
): PreparedSourceFile[] {
  const archivePath = resolve(
    DOCS_ROOT,
    "public/source-data",
    library,
    type,
    `${name}.source.json`,
  );
  if (!existsSync(archivePath)) {
    throw new Error(`Missing generated docs data: ${archivePath}`);
  }
  return parseScaffoldSourceArtifact(type, readJsonArtifact(archivePath), archivePath);
}

function loadPreparedScaffoldData(path: string): PreparedScaffoldData | null {
  const match = /^\/(ui|keys)\/(components|hooks)\/([a-z0-9-]+)$/.exec(path);
  if (!match) return null;
  const library = match[1];
  const type = match[2];
  const name = match[3];
  if ((library !== "ui" && library !== "keys") || !type || !name) return null;
  if (type !== "components" && type !== "hooks") return null;

  const dataPath = resolve(DOCS_ROOT, "src/generated", library, type, `${name}.json`);
  if (!existsSync(dataPath)) return null;

  const data = parseScaffoldPageArtifact(type, readJsonArtifact(dataPath), dataPath);
  const sourceFiles = readPreparedSourceFiles(library, type, name);
  if (type === "components") {
    return prepareComponentScaffoldData(library, data as ComponentPageData, sourceFiles);
  }
  return prepareHookScaffoldData(library, data as HookPageData, sourceFiles);
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

function pageMarkdownFromSource(page: PreRenderPage): PageMarkdown | null {
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

function markdownOutputPath(outDir: string, path: string): string {
  return join(outDir, markdownRelativePath(path));
}

export const LLMS_MANIFEST_FILE = ".llms-markdown-manifest.json";

const llmsManifestSchema = z
  .object({
    version: z.literal(1),
    markdown: z.array(z.string()),
  })
  .strict();

function validateOwnedMarkdownPath(path: string): string {
  const segments = path.split("/");
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    isAbsolute(path) ||
    path.includes("\\") ||
    !path.endsWith(".md") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
    posix.normalize(path) !== path
  ) {
    throw new Error(`Invalid llms markdown manifest path: ${path}`);
  }
  return path;
}

function markdownRelativePath(routePath: string): string {
  if (!routePath.startsWith("/")) {
    throw new Error(`Invalid documentation route path: ${routePath}`);
  }
  return validateOwnedMarkdownPath(`${routePath.slice(1)}.md`);
}

function readOwnedMarkdownPaths(outDir: string): string[] {
  const manifestPath = join(outDir, LLMS_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return [];
  const parsed = llmsManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf-8")));
  return [...new Set(parsed.markdown.map(validateOwnedMarkdownPath))].sort();
}

function assertOwnedPathsStayWithinOutput(outDir: string, paths: string[]): void {
  const outputPath = resolve(outDir);
  const outputRoot = existsSync(outputPath) ? realpathSync(outputPath) : outputPath;
  for (const path of paths) {
    let current = outputPath;
    for (const segment of path.split("/").slice(0, -1)) {
      current = join(current, segment);
      if (!existsSync(current)) break;
      const canonical = realpathSync(current);
      const relativePath = relative(outputRoot, canonical);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      ) {
        throw new Error(`Llms markdown path escapes the output directory: ${path}`);
      }
    }
  }
}

function atomicWriteFile(target: string, content: string | Uint8Array): void {
  mkdirSync(dirname(target), { recursive: true });
  const tempPath = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempPath, content, { flag: "wx" });
    renameSync(tempPath, target);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

function isFileSystemError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function pruneEmptyOwnedDirectories(outDir: string, paths: string[]): void {
  const root = resolve(outDir);
  const directories = [...new Set(paths.map((path) => dirname(join(root, path))))].sort(
    (a, b) => b.length - a.length,
  );
  for (const directory of directories) {
    let current = directory;
    let relativeDirectory = relative(root, current);
    while (
      relativeDirectory.length > 0 &&
      relativeDirectory !== ".." &&
      !relativeDirectory.startsWith(`..${sep}`) &&
      !isAbsolute(relativeDirectory)
    ) {
      try {
        rmdirSync(current);
      } catch (error) {
        if (isFileSystemError(error, "ENOENT")) {
          current = dirname(current);
          relativeDirectory = relative(root, current);
          continue;
        }
        if (isFileSystemError(error, "ENOTDIR") || isFileSystemError(error, "ENOTEMPTY")) break;
        throw error;
      }
      current = dirname(current);
      relativeDirectory = relative(root, current);
    }
  }
}

interface FileSnapshot {
  path: string;
  content: Buffer | null;
}

function snapshotFiles(paths: string[]): FileSnapshot[] {
  return [...new Set(paths)].map((path) => ({
    path,
    content: existsSync(path) ? readFileSync(path) : null,
  }));
}

function restoreFiles(snapshots: FileSnapshot[], outDir: string, ownedPaths: string[]): void {
  for (const snapshot of snapshots.toReversed()) {
    if (snapshot.content === null) {
      if (existsSync(snapshot.path)) rmSync(snapshot.path, { force: true });
    } else {
      atomicWriteFile(snapshot.path, snapshot.content);
    }
  }
  pruneEmptyOwnedDirectories(outDir, ownedPaths);
}

export function writeLlmsFiles(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  options: { origin?: string; pages?: PreRenderPage[] } = {},
): { count: number; llmsTarget: string; llmsFullTarget: string; markdownTargets: string[] } {
  const origin = options.origin ?? resolveOrigin();
  const pages = (options.pages ?? getPreRenderPages())
    .map(pageMarkdownFromSource)
    .filter((page): page is PageMarkdown => page !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
  const markdownFiles = pages.map((page) => ({
    relativePath: markdownRelativePath(page.path),
    target: markdownOutputPath(outDir, page.path),
    content: page.markdown,
  }));
  const nextOwnedPaths = markdownFiles.map((file) => file.relativePath);
  if (new Set(nextOwnedPaths).size !== nextOwnedPaths.length) {
    throw new Error("Duplicate llms markdown output path");
  }
  const previousOwnedPaths = readOwnedMarkdownPaths(outDir);
  assertOwnedPathsStayWithinOutput(outDir, [...previousOwnedPaths, ...nextOwnedPaths]);
  const nextOwnedSet = new Set(nextOwnedPaths);
  const staleOwnedPaths = previousOwnedPaths.filter((path) => !nextOwnedSet.has(path));
  const llmsTarget = join(outDir, "llms.txt");
  const llmsFullTarget = join(outDir, "llms-full.txt");
  const manifestTarget = join(outDir, LLMS_MANIFEST_FILE);
  const llmsContent = buildLlmsTxt(pages, origin);
  const llmsFullContent = `${pages.map((page) => page.markdown.trim()).join("\n\n---\n\n")}\n`;
  const manifestContent = `${JSON.stringify(
    { version: 1, markdown: [...nextOwnedPaths].sort() },
    null,
    2,
  )}\n`;
  const staleTargets = staleOwnedPaths.map((path) => join(outDir, path));
  const snapshots = snapshotFiles([
    ...markdownFiles.map((file) => file.target),
    ...staleTargets,
    llmsTarget,
    llmsFullTarget,
    manifestTarget,
  ]);

  try {
    for (const file of markdownFiles) {
      atomicWriteFile(file.target, file.content);
    }
    atomicWriteFile(llmsTarget, llmsContent);
    atomicWriteFile(llmsFullTarget, llmsFullContent);
    for (const staleTarget of staleTargets) {
      rmSync(staleTarget, { force: true });
    }
    pruneEmptyOwnedDirectories(outDir, staleOwnedPaths);
    atomicWriteFile(manifestTarget, manifestContent);
  } catch (error) {
    restoreFiles(snapshots, outDir, nextOwnedPaths);
    throw error;
  }

  return {
    count: pages.length,
    llmsTarget,
    llmsFullTarget,
    markdownTargets: markdownFiles.map((file) => file.target),
  };
}

export function writeDocsMetadata(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  options: { origin?: string; pages?: PreRenderPage[] } = {},
) {
  const origin = options.origin ?? resolveOrigin();
  const sitemap = writeSitemap(outDir, origin);
  const llms = writeLlmsFiles(outDir, { ...options, origin });
  return { sitemap, llms };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const writeAll = args.includes("--all");
  const outDir = resolveGeneratorOutputDir(args.filter((arg) => arg !== "--all"));
  const origin = resolveOrigin();
  const generated = writeAll
    ? writeDocsMetadata(outDir, { origin })
    : { sitemap: null, llms: writeLlmsFiles(outDir, { origin }) };
  const { sitemap } = generated;
  const { count, llmsTarget, llmsFullTarget } = generated.llms;
  if (sitemap) {
    console.log(`[sitemap] wrote ${sitemap.count} urls to ${sitemap.target}`);
    console.log(`[robots] wrote ${sitemap.robotsTarget}`);
  }
  console.log(`[llms] wrote ${count} markdown pages to ${llmsTarget}`);
  console.log(`[llms-full] wrote ${llmsFullTarget}`);
}
