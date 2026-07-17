import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PUBLIC_ORIGIN, resolvePublicOrigin } from "../src/lib/public-origin.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const require = createRequire(import.meta.url);
export const DEFAULT_ORIGIN = DEFAULT_PUBLIC_ORIGIN;
export const DOCS_CONTENT_ROOT = resolve(DOCS_ROOT, "content/docs");

export interface PreRenderPage {
  path: string;
  source?: string;
}

interface DocsLibrary {
  id: string;
  enabled: boolean;
}

function readLibrariesConfig(): DocsLibrary[] {
  const configPath = resolve(DOCS_ROOT, "config/docs-libraries.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
    libraries: DocsLibrary[];
  };
  return config.libraries.filter((lib) => lib.enabled);
}

export function getPreRenderPages(): PreRenderPage[] {
  const enabledLibraries = readLibrariesConfig();
  const contentDir = DOCS_CONTENT_ROOT;

  // Library roots (/ui, /keys, /app) 307-redirect to their first page, so the
  // sitemap lists those canonical first pages (emitted by walkMdx) rather than
  // the redirecting roots.
  const legalDir = resolve(DOCS_ROOT, "content/legal");
  const pages: PreRenderPage[] = [{ path: "/" }];
  for (const entry of readdirSync(legalDir).sort()) {
    if (!entry.endsWith(".mdx")) continue;
    pages.push({
      path: `/${entry.replace(/\.mdx$/, "")}`,
      source: join(legalDir, entry),
    });
  }

  function walkMdx(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "components" || entry.name === "hooks") {
          pushSectionIndexPage(pages, contentDir, enabledLibraries, full);
          continue;
        }
        walkMdx(full);
        continue;
      }
      if (!entry.name.endsWith(".mdx")) continue;
      const rel = relative(contentDir, full).replace(/\.mdx$/, "");
      if (rel === "index") continue;

      const lib = enabledLibraries.find((l) => rel.startsWith(`${l.id}/`));
      if (!lib) continue;

      const libRel = rel.slice(`${lib.id}/`.length).replace(/(?:^|\/)index$/, "");
      if (libRel.length === 0) continue;
      pages.push({ path: `/${lib.id}/${libRel}`, source: full });
    }
  }
  walkMdx(contentDir);

  for (const lib of enabledLibraries) {
    pushGeneratedListPages(pages, lib.id, "component-list.json", "components");
    pushGeneratedListPages(pages, lib.id, "hook-list.json", "hooks");
  }

  return pages;
}

function pushSectionIndexPage(
  pages: PreRenderPage[],
  contentDir: string,
  enabledLibraries: DocsLibrary[],
  sectionDir: string,
) {
  const indexSource = join(sectionDir, "index.mdx");
  if (!existsSync(indexSource)) return;

  const rel = relative(contentDir, sectionDir);
  const lib = enabledLibraries.find((l) => rel.startsWith(`${l.id}/`));
  if (!lib) return;

  pages.push({ path: `/${rel}`, source: indexSource });
}

function pushGeneratedListPages(
  pages: PreRenderPage[],
  libId: string,
  fileName: string,
  routeSegment: string,
) {
  const listPath = resolve(DOCS_ROOT, `src/generated/${libId}/${fileName}`);
  if (!existsSync(listPath)) return;
  const items = JSON.parse(readFileSync(listPath, "utf-8")) as Array<{
    name: string;
  }>;
  for (const item of items) {
    const source = resolve(DOCS_ROOT, `content/docs/${libId}/${routeSegment}/${item.name}.mdx`);
    pages.push({
      path: `/${libId}/${routeSegment}/${item.name}`,
      source: existsSync(source) ? source : undefined,
    });
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(pages: PreRenderPage[], origin: string): string {
  const urls = pages
    .map((page) => {
      const loc = escapeXml(`${origin}${page.path === "/" ? "" : page.path}`);
      return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function resolveOrigin(envDir = DOCS_ROOT): string {
  let configuredOrigin = process.env.VITE_PUBLIC_ORIGIN;
  if (configuredOrigin === undefined) {
    const { loadEnv } = require("vite") as typeof import("vite");
    configuredOrigin = loadEnv("production", envDir, "VITE_").VITE_PUBLIC_ORIGIN;
  }
  return resolvePublicOrigin(configuredOrigin);
}

export function resolveGeneratorOutputDir(args: string[], cwd = process.cwd()): string | undefined {
  const outputDirs = args.filter((arg) => arg !== "--");
  if (outputDirs.length === 0) return undefined;
  if (outputDirs.length > 1) {
    throw new Error("Expected at most one generator output directory");
  }
  const outputDir = outputDirs[0];
  return outputDir === undefined ? undefined : resolve(cwd, outputDir);
}

function buildRobotsTxt(origin: string): string {
  return `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function writeSitemap(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  origin = resolveOrigin(),
): {
  target: string;
  robotsTarget: string;
  count: number;
} {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const pages = getPreRenderPages();
  const xml = buildSitemapXml(pages, origin);
  const sitemapTarget = join(outDir, "sitemap.xml");
  writeFileSync(sitemapTarget, xml, "utf-8");

  const robotsTxt = buildRobotsTxt(origin);
  const robotsTarget = join(outDir, "robots.txt");
  writeFileSync(robotsTarget, robotsTxt, "utf-8");

  return { target: sitemapTarget, robotsTarget, count: pages.length };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const outDir = resolveGeneratorOutputDir(process.argv.slice(2));
  const { target, robotsTarget, count } = writeSitemap(outDir);
  console.log(`[sitemap] wrote ${count} urls to ${target}`);
  console.log(`[robots] wrote ${robotsTarget}`);
}
