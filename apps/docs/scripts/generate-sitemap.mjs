import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const DEFAULT_ORIGIN = "https://docs.b4r7.dev";

function readLibrariesConfig() {
	const configPath = resolve(DOCS_ROOT, "config/docs-libraries.json");
	const config = JSON.parse(readFileSync(configPath, "utf-8"));
	return config.libraries.filter((lib) => lib.enabled);
}

export function getPreRenderPages() {
	const enabledLibraries = readLibrariesConfig();
	const contentDir = resolve(DOCS_ROOT, "content/docs");

	// Library roots (/ui, /keys, /app) 307-redirect to their first page, so the
	// sitemap lists those canonical first pages (emitted by walkMdx) rather than
	// the redirecting roots.
	const pages = [{ path: "/", source: null }];

	function walkMdx(dir) {
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

			const libRel = rel
				.slice(`${lib.id}/`.length)
				.replace(/(?:^|\/)index$/, "");
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

function pushSectionIndexPage(pages, contentDir, enabledLibraries, sectionDir) {
	const indexSource = join(sectionDir, "index.mdx");
	if (!existsSync(indexSource)) return;

	const rel = relative(contentDir, sectionDir);
	const lib = enabledLibraries.find((l) => rel.startsWith(`${l.id}/`));
	if (!lib) return;

	pages.push({ path: `/${rel}`, source: indexSource });
}

function pushGeneratedListPages(pages, libId, fileName, routeSegment) {
	const listPath = resolve(DOCS_ROOT, `src/generated/${libId}/${fileName}`);
	if (!existsSync(listPath)) return;
	const items = JSON.parse(readFileSync(listPath, "utf-8"));
	for (const item of items) {
		pages.push({
			path: `/${libId}/${routeSegment}/${item.name}`,
			source: resolveItemMdxSource(libId, routeSegment, item.name),
		});
	}
}

function resolveItemMdxSource(libId, routeSegment, name) {
	const candidate = resolve(
		DOCS_ROOT,
		`content/docs/${libId}/${routeSegment}/${name}.mdx`,
	);
	return existsSync(candidate) ? candidate : null;
}

/** Cache git log timestamps so we only spawn once per source file. */
const gitTimestampCache = new Map();

function getGitTimestamp(filePath) {
	if (gitTimestampCache.has(filePath)) return gitTimestampCache.get(filePath);
	try {
		const iso = execFileSync(
			"git",
			["log", "-1", "--format=%aI", "--", filePath],
			{ encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
		).trim();
		const result = iso || null;
		gitTimestampCache.set(filePath, result);
		return result;
	} catch {
		gitTimestampCache.set(filePath, null);
		return null;
	}
}

function formatLastMod(sourcePath) {
	if (sourcePath && existsSync(sourcePath)) {
		const gitDate = getGitTimestamp(sourcePath);
		if (gitDate) return new Date(gitDate).toISOString();
	}
	// Fallback: fixed date so the sitemap is reproducible across builds.
	return "2025-01-01T00:00:00.000Z";
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

function buildRobotsTxt(origin) {
	return `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function writeSitemap(outDir = resolve(DOCS_ROOT, ".output/public")) {
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true });
	}
	const origin = resolveOrigin();
	const pages = getPreRenderPages();
	const xml = buildSitemapXml(pages, origin);
	const sitemapTarget = join(outDir, "sitemap.xml");
	writeFileSync(sitemapTarget, xml, "utf-8");

	const robotsTxt = buildRobotsTxt(origin);
	const robotsTarget = join(outDir, "robots.txt");
	writeFileSync(robotsTarget, robotsTxt, "utf-8");

	return { target: sitemapTarget, robotsTarget, count: pages.length };
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
	const outDirArg = process.argv[2];
	const outDir = outDirArg ? resolve(process.cwd(), outDirArg) : undefined;
	const { target, robotsTarget, count } = writeSitemap(outDir);
	console.log(`[sitemap] wrote ${count} urls to ${target}`);
	console.log(`[robots] wrote ${robotsTarget}`);
}
