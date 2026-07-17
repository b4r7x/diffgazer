import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_CONTENT_ROOT, getPreRenderPages, type PreRenderPage } from "./generate-sitemap.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const ORIGIN = "https://docs.example";

export interface MdxLink {
  href: string;
  line: number;
}

export interface MdxFile {
  filePath: string;
  routePath: string;
  content: string;
}

export interface BrokenInternalLink {
  filePath: string;
  line: number;
  href: string;
  resolvedPath: string;
}

function normalizePath(path: string): string {
  if (path === "") return "/";
  const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash;
}

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

export function resolveInternalHref(href: string, routePath: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || isExternalHref(trimmed)) return null;

  const url = new URL(trimmed, `${ORIGIN}${routePath}`);
  if (url.origin !== ORIGIN) return null;

  return normalizePath(url.pathname);
}

export function extractInternalLinks(content: string): MdxLink[] {
  const links: MdxLink[] = [];
  const patterns = [/(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, /href="([^"]+)"/g];

  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const href = match[1];
        if (href) links.push({ href, line: index + 1 });
      }
    }
  }

  return links;
}

function walkMdxFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMdxFiles(full, files);
      continue;
    }
    if (entry.name.endsWith(".mdx")) files.push(full);
  }

  return files;
}

function fallbackRoutePath(filePath: string): string {
  const rel = relative(DOCS_CONTENT_ROOT, filePath).replace(/\.mdx$/, "");
  if (rel.startsWith("..")) {
    return `/${
      filePath
        .split("/")
        .at(-1)
        ?.replace(/\.mdx$/, "") ?? ""
    }`;
  }

  const [libId, ...rest] = rel.split("/");
  const libRel = rest.join("/").replace(/(?:^|\/)index$/, "");
  return normalizePath(libRel.length > 0 ? `/${libId}/${libRel}` : `/${libId}`);
}

function routePathBySource(pages: PreRenderPage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    if (page.source) map.set(page.source, page.path);
  }
  return map;
}

export function collectMdxFiles(
  roots = [resolve(DOCS_ROOT, "content/docs"), resolve(DOCS_ROOT, "content/legal")],
  pages = getPreRenderPages(),
): MdxFile[] {
  const sourceRoutes = routePathBySource(pages);
  return roots.flatMap((root) =>
    walkMdxFiles(root).map((filePath) => ({
      filePath,
      routePath: sourceRoutes.get(filePath) ?? fallbackRoutePath(filePath),
      content: readFileSync(filePath, "utf-8"),
    })),
  );
}

export function findBrokenInternalLinks(
  params: { files?: MdxFile[]; pages?: PreRenderPage[] } = {},
): BrokenInternalLink[] {
  const pages = params.pages ?? getPreRenderPages();
  const validPaths = new Set(pages.map((page) => normalizePath(page.path)));
  const files = params.files ?? collectMdxFiles(undefined, pages);
  const broken: BrokenInternalLink[] = [];

  for (const file of files) {
    for (const link of extractInternalLinks(file.content)) {
      const resolvedPath = resolveInternalHref(link.href, file.routePath);
      if (!resolvedPath || validPaths.has(resolvedPath)) continue;
      broken.push({
        filePath: file.filePath,
        line: link.line,
        href: link.href,
        resolvedPath,
      });
    }
  }

  return broken;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const broken = findBrokenInternalLinks();
  if (broken.length > 0) {
    const details = broken
      .map(
        (link) =>
          `${relative(process.cwd(), link.filePath)}:${link.line} ${link.href} -> ${link.resolvedPath}`,
      )
      .join("\n");
    console.error(`[internal-links] ${broken.length} broken internal link(s)\n${details}`);
    process.exit(1);
  }
  console.log("[internal-links] ok");
}
