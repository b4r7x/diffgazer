import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeLlmsFiles } from "../../scripts/generate-llms/output";
import { resolveOrigin, writeSitemap } from "../../scripts/generate-sitemap";
import { DEFAULT_PUBLIC_ORIGIN, resolvePublicOrigin } from "./public-origin";
import {
  buildCanonicalUrl,
  buildPageSeo,
  buildRootHeadDefaults,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  PUBLIC_ORIGIN,
} from "./seo";

const sitemapModuleUrl = pathToFileURL(
  resolve(import.meta.dirname, "../../scripts/generate-sitemap.ts"),
).href;

function resolveProductionOriginInNode(envDir: string): string {
  const env = { ...process.env };
  delete env.VITE_PUBLIC_ORIGIN;
  return execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      "const { resolveOrigin } = await import(process.env.SITEMAP_MODULE_URL); process.stdout.write(resolveOrigin(process.env.DOCS_ENV_DIR));",
    ],
    {
      encoding: "utf8",
      env: { ...env, DOCS_ENV_DIR: envDir, SITEMAP_MODULE_URL: sitemapModuleUrl },
    },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolvePublicOrigin", () => {
  it("uses the fallback only when configuration is absent", () => {
    expect(resolvePublicOrigin()).toBe(DEFAULT_PUBLIC_ORIGIN);
    expect(() => resolvePublicOrigin("")).toThrow(/absolute HTTP\(S\) origin/);
    expect(() => resolvePublicOrigin("   ")).toThrow(/absolute HTTP\(S\) origin/);
  });

  it("normalizes valid HTTP(S) origins and their trailing slashes", () => {
    expect(resolvePublicOrigin("https://docs.example.test///")).toBe("https://docs.example.test");
    expect(resolvePublicOrigin("http://localhost:4173/")).toBe("http://localhost:4173");
  });

  it.each([
    "javascript:alert(1)",
    "ftp://docs.example.test",
    "https://",
    "https:///missing-host",
    "https://docs example.test",
    "https://docs.example.test/reference",
    "https://docs.example.test?preview=1",
  ])("rejects invalid configured origin %s", (configuredOrigin) => {
    expect(() => resolvePublicOrigin(configuredOrigin)).toThrow(/absolute HTTP\(S\) origin/);
  });

  it("applies the same normalization at the runtime SEO boundary", async () => {
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://docs.example.test///");
    vi.resetModules();

    const runtimeSeo = await import("./seo");

    expect(runtimeSeo.PUBLIC_ORIGIN).toBe("https://docs.example.test");
    expect(runtimeSeo.buildCanonicalUrl("/ui")).toBe("https://docs.example.test/ui");
  });

  it("uses one production env origin for canonical, sitemap, robots, and LLM output", async () => {
    const envDir = mkdtempSync(join(tmpdir(), "diffgazer-docs-origin-"));
    const outDir = join(envDir, "public");
    const sourcePath = join(envDir, "page.mdx");
    vi.stubEnv("VITE_PUBLIC_ORIGIN", undefined);
    writeFileSync(
      join(envDir, ".env.production"),
      "VITE_PUBLIC_ORIGIN=https://docs.production.test///\n",
    );
    writeFileSync(
      sourcePath,
      ["---", "title: Test page", "description: Test.", "---", "", "Body."].join("\n"),
    );

    try {
      const origin = resolveProductionOriginInNode(envDir);
      vi.stubEnv("VITE_PUBLIC_ORIGIN", origin);
      vi.resetModules();
      const productionSeo = await import("./seo");
      writeSitemap(outDir, origin);
      writeLlmsFiles(outDir, {
        origin,
        pages: [{ path: "/app/test-page", source: sourcePath }],
      });

      expect(productionSeo.buildCanonicalUrl("/app/test-page")).toBe(
        "https://docs.production.test/app/test-page",
      );
      expect(readFileSync(join(outDir, "sitemap.xml"), "utf8")).toContain(
        "https://docs.production.test",
      );
      expect(readFileSync(join(outDir, "robots.txt"), "utf8")).toContain(
        "Sitemap: https://docs.production.test/sitemap.xml",
      );
      expect(readFileSync(join(outDir, "llms.txt"), "utf8")).toContain(
        "https://docs.production.test/app/test-page.md",
      );
    } finally {
      rmSync(envDir, { recursive: true, force: true });
    }
  });

  it("gives an explicit process origin priority over .env.production", () => {
    const envDir = mkdtempSync(join(tmpdir(), "diffgazer-docs-origin-priority-"));
    writeFileSync(
      join(envDir, ".env.production"),
      "VITE_PUBLIC_ORIGIN=https://docs.production.test\n",
    );
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://docs.override.test/");

    try {
      expect(resolveOrigin(envDir)).toBe("https://docs.override.test");
    } finally {
      rmSync(envDir, { recursive: true, force: true });
    }
  });
});

function findMeta(
  meta: ReturnType<typeof buildPageSeo>["meta"],
  key: "name" | "property",
  value: string,
) {
  return meta.find((tag) => (tag as Record<string, unknown>)[key] === value) as
    | Record<string, string>
    | undefined;
}

function findTitle(meta: ReturnType<typeof buildPageSeo>["meta"]) {
  return meta.find((tag) => "title" in tag) as { title: string } | undefined;
}

describe("buildCanonicalUrl", () => {
  it("prepends the public origin to absolute pathnames", () => {
    expect(buildCanonicalUrl("/ui/components/button")).toBe(
      `${PUBLIC_ORIGIN}/ui/components/button`,
    );
  });

  it("normalises relative pathnames into absolute ones before joining", () => {
    expect(buildCanonicalUrl("ui")).toBe(`${PUBLIC_ORIGIN}/ui`);
  });
});

describe("buildPageSeo", () => {
  it("emits a title, canonical link, and the required SEO meta tags", () => {
    const seo = buildPageSeo({
      title: "Button - UI Docs",
      description: "Button primitive",
      pathname: "/ui/components/button",
    });

    expect(findTitle(seo.meta)?.title).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "name", "description")?.content).toBe("Button primitive");
    expect(findMeta(seo.meta, "property", "og:title")?.content).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "property", "og:description")?.content).toBe("Button primitive");
    expect(findMeta(seo.meta, "property", "og:type")?.content).toBe("article");
    expect(findMeta(seo.meta, "property", "og:url")?.content).toBe(
      `${PUBLIC_ORIGIN}/ui/components/button`,
    );
    expect(findMeta(seo.meta, "property", "og:site_name")?.content).toBe(DEFAULT_SITE_NAME);
    expect(findMeta(seo.meta, "name", "twitter:card")?.content).toBe("summary");
    expect(findMeta(seo.meta, "name", "twitter:title")?.content).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "name", "twitter:description")?.content).toBe("Button primitive");

    const canonical = seo.links.find((link) => link.rel === "canonical");
    expect(canonical?.href).toBe(`${PUBLIC_ORIGIN}/ui/components/button`);
  });

  it("falls back to the default site description when no per-page description is given", () => {
    const seo = buildPageSeo({
      title: "Library Index",
      pathname: "/ui",
    });

    expect(findMeta(seo.meta, "name", "description")?.content).toBe(DEFAULT_SITE_DESCRIPTION);
    expect(findMeta(seo.meta, "property", "og:description")?.content).toBe(
      DEFAULT_SITE_DESCRIPTION,
    );
    expect(findMeta(seo.meta, "name", "twitter:description")?.content).toBe(
      DEFAULT_SITE_DESCRIPTION,
    );
  });

  it("honors the type override for non-article pages", () => {
    const seo = buildPageSeo({
      title: "Home",
      pathname: "/",
      type: "website",
    });

    expect(findMeta(seo.meta, "property", "og:type")?.content).toBe("website");
  });
});

describe("buildRootHeadDefaults", () => {
  it("emits charset, viewport, theme-color, and the SEO defaults", () => {
    const { meta, links } = buildRootHeadDefaults();

    expect(meta.some((tag) => "charSet" in tag && tag.charSet === "utf-8")).toBe(true);
    expect(findMeta(meta, "name", "viewport")?.content).toBe("width=device-width, initial-scale=1");
    expect(findMeta(meta, "name", "theme-color")?.content).toBe("#0a0a0a");
    expect(findMeta(meta, "name", "description")?.content).toBe(DEFAULT_SITE_DESCRIPTION);
    expect(findMeta(meta, "name", "twitter:card")?.content).toBe("summary");
    expect(findTitle(meta)?.title).toBe(DEFAULT_SITE_NAME);

    const manifest = links.find((link) => link.rel === "manifest");
    expect(manifest?.href).toBe("/manifest.json");
  });

  it("includes favicon and apple-touch-icon links", () => {
    const { links } = buildRootHeadDefaults();

    const favicon = links.find((link) => link.rel === "icon");
    expect(favicon?.href).toBe("/favicon.ico");

    const appleTouchIcon = links.find((link) => link.rel === "apple-touch-icon");
    expect(appleTouchIcon?.href).toBe("/logo192.png");
  });

  it("includes og:image meta tag", () => {
    const { meta } = buildRootHeadDefaults();

    expect(findMeta(meta, "property", "og:image")?.content).toBe(`${PUBLIC_ORIGIN}/logo512.png`);
  });

  it("does not include a root canonical link (pages set their own)", () => {
    const { links } = buildRootHeadDefaults();

    const canonical = links.find((link) => link.rel === "canonical");
    expect(canonical).toBeUndefined();
  });

  it("includes og:url from PUBLIC_ORIGIN", () => {
    const { meta } = buildRootHeadDefaults();

    expect(findMeta(meta, "property", "og:url")?.content).toBe(PUBLIC_ORIGIN);
  });
});
