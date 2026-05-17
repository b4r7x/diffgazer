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

  it("emits a single landing page per enabled library", () => {
    const pages = getPreRenderPages();
    const uiLanding = pages.filter((page) => page.path === "/ui/docs");
    const keysLanding = pages.filter((page) => page.path === "/keys/docs");

    expect(uiLanding).toHaveLength(1);
    expect(keysLanding).toHaveLength(1);
  });

  it("does not include the orphaned /ui/docs/index path", () => {
    const pages = getPreRenderPages();
    expect(pages.some((page) => page.path === "/ui/docs/index")).toBe(false);
    expect(pages.some((page) => page.path === "/keys/docs/index")).toBe(false);
  });

  it("does not include the non-existent /docs route", () => {
    const pages = getPreRenderPages();
    expect(pages.some((page) => page.path === "/docs")).toBe(false);
  });

  it("emits hook pages exactly once even though hook content lives under content/docs/{lib}/hooks", () => {
    const pages = getPreRenderPages();
    const hookPaths = pages
      .map((page) => page.path)
      .filter((path) => path.startsWith("/keys/docs/hooks/") || path.startsWith("/ui/docs/hooks/"));

    expect(new Set(hookPaths).size).toBe(hookPaths.length);
    expect(hookPaths.length).toBeGreaterThan(0);
  });

  it("emits component pages exactly once via the generated component list", () => {
    const pages = getPreRenderPages();
    const componentPaths = pages
      .map((page) => page.path)
      .filter((path) => path.startsWith("/ui/docs/components/"));

    expect(new Set(componentPaths).size).toBe(componentPaths.length);
    expect(componentPaths.length).toBeGreaterThan(0);
  });

  it("resolves a source MDX file for landing pages so lastmod can use mtime", () => {
    const pages = getPreRenderPages();
    const uiLanding = pages.find((page) => page.path === "/ui/docs");

    expect(uiLanding).toBeDefined();
    expect(uiLanding?.source).not.toBeNull();
    expect(uiLanding?.source).toContain(`${docsRoot}/content/docs/ui/index.mdx`);
  });
});
