import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPreRenderPages, resolveGeneratorOutputDir, resolveOrigin } from "./generate-sitemap.ts";

const PAGER_EXAMPLES = [
  "../../../libs/ui/registry/examples/pager/pager-default.tsx",
  "../../../libs/ui/registry/examples/pager/pager-single.tsx",
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveOrigin", () => {
  it("matches the runtime resolver's normalized origin", async () => {
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://docs.example.test///");
    vi.resetModules();

    expect(resolveOrigin()).toBe("https://docs.example.test");
    expect((await import("../src/lib/seo.ts")).PUBLIC_ORIGIN).toBe(resolveOrigin());
  });

  it("fails for a configured non-HTTP origin", () => {
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "ftp://docs.example.test");

    expect(() => resolveOrigin()).toThrow(/absolute HTTP\(S\) origin/);
  });
});

describe("resolveGeneratorOutputDir", () => {
  const cwd = "/workspace/apps/docs";

  it.each([
    ["public"],
    ["--", "public"],
  ])("resolves the package-script output directory from %j", (...args) => {
    expect(resolveGeneratorOutputDir(args, cwd)).toBe("/workspace/apps/docs/public");
  });

  it("uses the generator default when no output directory is passed", () => {
    expect(resolveGeneratorOutputDir([], cwd)).toBeUndefined();
  });

  it("rejects ambiguous output directories", () => {
    expect(() => resolveGeneratorOutputDir(["public", "other"], cwd)).toThrow(
      "Expected at most one generator output directory",
    );
  });
});

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

  it("includes legal pages", () => {
    const pages = getPreRenderPages();
    expect(pages.some((page) => page.path === "/privacy")).toBe(true);
    expect(pages.some((page) => page.path === "/terms")).toBe(true);
  });

  it("includes source paths for authored pages", () => {
    const pages = getPreRenderPages();

    expect(pages.find((page) => page.path === "/privacy")?.source).toMatch(
      /content\/legal\/privacy\.mdx$/,
    );
    expect(pages.find((page) => page.path === "/app/getting-started")?.source).toMatch(
      /content\/docs\/app\/getting-started\/index\.mdx$/,
    );
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
      .filter((path) => path.startsWith("/keys/hooks/") || path.startsWith("/ui/hooks/"));

    expect(new Set(hookPaths).size).toBe(hookPaths.length);
    expect(hookPaths.length).toBeGreaterThan(0);
  });

  it("includes the hook index routes when hooks/index.mdx exists", () => {
    const pages = getPreRenderPages();

    const uiHooksIndex = pages.filter((page) => page.path === "/ui/hooks");
    const keysHooksIndex = pages.filter((page) => page.path === "/keys/hooks");

    expect(uiHooksIndex).toHaveLength(1);
    expect(keysHooksIndex).toHaveLength(1);
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
    expect(pages.find((page) => page.path === "/ui/components/button")?.source).toMatch(
      /content\/docs\/ui\/components\/button\.mdx$/,
    );
  });

  it("includes the first-page redirect target for each enabled library", () => {
    const pages = getPreRenderPages();
    const paths = pages.map((page) => page.path);

    expect(paths).toContain("/ui/getting-started");
    expect(paths).toContain("/keys/getting-started");
    expect(paths).toContain("/app/getting-started");
  });

  it("keeps every Pager example href on a prerendered route", () => {
    const prerenderedPaths = new Set(getPreRenderPages().map((page) => page.path));
    const hrefs = PAGER_EXAMPLES.flatMap((relativePath) => {
      const source = readFileSync(resolve(import.meta.dirname, relativePath), "utf-8");
      return [...source.matchAll(/href="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((href): href is string => href !== undefined);
    });

    expect(hrefs).toEqual([
      "/ui/components/button",
      "/ui/components/checkbox",
      "/ui/getting-started",
    ]);
    for (const href of hrefs) expect(prerenderedPaths.has(href)).toBe(true);
  });
});
