import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const DEFAULT_ORIGIN = "https://diffgazer.com";

function readLibrariesConfig() {
  const configPath = resolve(DOCS_ROOT, "config/docs-libraries.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  return config.libraries.filter((lib) => lib.enabled);
}

export function getPreRenderPages() {
  const enabledLibraries = readLibrariesConfig();
  const contentDir = resolve(DOCS_ROOT, "content/docs");

  const pages = [
    { path: "/", source: null },
    ...enabledLibraries.map((lib) => ({
      path: `/${lib.id}/docs`,
      source: findLibraryIntroSource(contentDir, lib.id),
    })),
  ];

  function walkMdx(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "components" || entry.name === "hooks") continue;
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
      pages.push({ path: `/${lib.id}/docs/${libRel}`, source: full });
    }
  }
  walkMdx(contentDir);

  for (const lib of enabledLibraries) {
    pushGeneratedListPages(pages, lib.id, "component-list.json", "components");
    pushGeneratedListPages(pages, lib.id, "hook-list.json", "hooks");
  }

  return pages;
}

function findLibraryIntroSource(contentDir, libId) {
  const candidate = resolve(contentDir, libId, "index.mdx");
  return existsSync(candidate) ? candidate : null;
}

function pushGeneratedListPages(pages, libId, fileName, routeSegment) {
  const listPath = resolve(DOCS_ROOT, `src/generated/${libId}/${fileName}`);
  if (!existsSync(listPath)) return;
  const items = JSON.parse(readFileSync(listPath, "utf-8"));
  for (const item of items) {
    pages.push({
      path: `/${libId}/docs/${routeSegment}/${item.name}`,
      source: resolveItemMdxSource(libId, routeSegment, item.name),
    });
  }
}

function resolveItemMdxSource(libId, routeSegment, name) {
  const candidate = resolve(DOCS_ROOT, `content/docs/${libId}/${routeSegment}/${name}.mdx`);
  return existsSync(candidate) ? candidate : null;
}

function formatLastMod(sourcePath) {
  if (sourcePath && existsSync(sourcePath)) {
    return statSync(sourcePath).mtime.toISOString();
  }
  return new Date().toISOString();
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(pages, origin) {
  const urls = pages
    .map((page) => {
      const loc = escapeXml(`${origin}${page.path === "/" ? "" : page.path}`);
      const lastmod = formatLastMod(page.source);
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function resolveOrigin() {
  const raw = process.env.VITE_PUBLIC_ORIGIN;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/+$/, "");
  }
  return DEFAULT_ORIGIN;
}

export function writeSitemap(outDir = resolve(DOCS_ROOT, ".output/public")) {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const pages = getPreRenderPages();
  const xml = buildSitemapXml(pages, resolveOrigin());
  const target = join(outDir, "sitemap.xml");
  writeFileSync(target, xml, "utf-8");
  return { target, count: pages.length };
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const outDirArg = process.argv[2];
  const outDir = outDirArg ? resolve(process.cwd(), outDirArg) : undefined;
  const { target, count } = writeSitemap(outDir);
  console.log(`[sitemap] wrote ${count} urls to ${target}`);
}
