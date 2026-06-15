import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPreRenderPages, type PreRenderPage, resolveOrigin } from "./generate-sitemap.ts";

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

export function sourceToMarkdown(source: string, fallbackTitle: string): PageMarkdown["markdown"] {
  const { frontmatter, body } = parseFrontmatter(source);
  const title = frontmatter.title ?? fallbackTitle;
  const description = frontmatter.description ?? "";
  const cleanedBody = stripMdxSyntax(body);
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
    markdown: sourceToMarkdown(source, title),
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
  return join(outDir, `${path.replace(/^\//, "")}.md`);
}

export function writeLlmsFiles(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  options: { origin?: string; pages?: PreRenderPage[] } = {},
): { count: number; llmsTarget: string; llmsFullTarget: string; markdownTargets: string[] } {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const origin = options.origin ?? resolveOrigin();
  const pages = (options.pages ?? getPreRenderPages())
    .map(pageMarkdownFromSource)
    .filter((page): page is PageMarkdown => page !== null)
    .sort((a, b) => a.path.localeCompare(b.path));

  const markdownTargets = pages.map((page) => {
    const target = markdownOutputPath(outDir, page.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, page.markdown, "utf-8");
    return target;
  });

  const llmsTarget = join(outDir, "llms.txt");
  writeFileSync(llmsTarget, buildLlmsTxt(pages, origin), "utf-8");

  const llmsFullTarget = join(outDir, "llms-full.txt");
  writeFileSync(
    llmsFullTarget,
    `${pages.map((page) => page.markdown.trim()).join("\n\n---\n\n")}\n`,
    "utf-8",
  );

  return { count: pages.length, llmsTarget, llmsFullTarget, markdownTargets };
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const outDirArg = process.argv[2];
  const outDir = outDirArg ? resolve(process.cwd(), outDirArg) : undefined;
  const { count, llmsTarget, llmsFullTarget } = writeLlmsFiles(outDir);
  console.log(`[llms] wrote ${count} markdown pages to ${llmsTarget}`);
  console.log(`[llms-full] wrote ${llmsFullTarget}`);
}
