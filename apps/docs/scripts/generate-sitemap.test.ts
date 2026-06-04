import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPreRenderPages } from "./generate-sitemap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, "..");

describe("getPreRenderPages", () => {
	it("emits unique page paths so sitemap entries are not duplicated", () => {
		const pages = getPreRenderPages();
		const paths = pages.map((page) => page.path);

		expect(new Set(paths).size).toBe(paths.length);
	});

	it("includes the site root", () => {
		const pages = getPreRenderPages();
		expect(pages.some((page) => page.path === "/")).toBe(true);
	});

	it("omits the library roots that redirect to their first page", () => {
		const pages = getPreRenderPages();
		for (const root of ["/ui", "/keys", "/app"]) {
			expect(pages.some((page) => page.path === root)).toBe(false);
		}
	});

	it("lists the first-page redirect targets instead of the library roots", () => {
		const pages = getPreRenderPages();
		for (const firstPage of [
			"/ui/getting-started",
			"/keys/getting-started",
			"/app/getting-started",
		]) {
			expect(pages.some((page) => page.path === firstPage)).toBe(true);
		}
	});

	it("does not include the orphaned /ui/index path", () => {
		const pages = getPreRenderPages();
		expect(pages.some((page) => page.path === "/ui/index")).toBe(false);
		expect(pages.some((page) => page.path === "/keys/index")).toBe(false);
	});

	it("does not include the non-existent /docs route", () => {
		const pages = getPreRenderPages();
		expect(pages.some((page) => page.path === "/docs")).toBe(false);
	});

	it("emits hook pages exactly once even though hook content lives under content/docs/{lib}/hooks", () => {
		const pages = getPreRenderPages();
		const hookPaths = pages
			.map((page) => page.path)
			.filter(
				(path) =>
					path.startsWith("/keys/hooks/") || path.startsWith("/ui/hooks/"),
			);

		expect(new Set(hookPaths).size).toBe(hookPaths.length);
		expect(hookPaths.length).toBeGreaterThan(0);
	});

	it("includes the hook index routes when hooks/index.mdx exists", () => {
		const pages = getPreRenderPages();

		const uiHooksIndex = pages.filter((page) => page.path === "/ui/hooks");
		const keysHooksIndex = pages.filter((page) => page.path === "/keys/hooks");

		expect(uiHooksIndex).toHaveLength(1);
		expect(keysHooksIndex).toHaveLength(1);
		expect(uiHooksIndex[0]?.source).toContain(
			`${docsRoot}/content/docs/ui/hooks/index.mdx`,
		);
		expect(keysHooksIndex[0]?.source).toContain(
			`${docsRoot}/content/docs/keys/hooks/index.mdx`,
		);
	});

	it("still includes generated hook item routes alongside the hook index", () => {
		const pages = getPreRenderPages();
		const paths = pages.map((page) => page.path);

		expect(paths).toContain("/ui/hooks/controllable-state");
		expect(paths).toContain("/keys/hooks/use-focus-trap");
	});

	it("emits component pages exactly once via the generated component list", () => {
		const pages = getPreRenderPages();
		const componentPaths = pages
			.map((page) => page.path)
			.filter((path) => path.startsWith("/ui/components/"));

		expect(new Set(componentPaths).size).toBe(componentPaths.length);
		expect(componentPaths.length).toBeGreaterThan(0);
	});

	it("resolves a source MDX file for the first-page targets so lastmod can use mtime", () => {
		const pages = getPreRenderPages();
		const uiFirstPage = pages.find((page) => page.path === "/ui/getting-started");

		expect(uiFirstPage).toBeDefined();
		expect(uiFirstPage?.source).not.toBeNull();
		expect(uiFirstPage?.source).toContain(
			`${docsRoot}/content/docs/ui/getting-started/index.mdx`,
		);
	});
});
