// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildCanonicalUrl,
  buildPageSeo,
  buildRootHeadDefaults,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  PUBLIC_ORIGIN,
} from "./seo";

function findMeta(meta: ReturnType<typeof buildPageSeo>["meta"], key: "name" | "property", value: string) {
  return meta.find((tag) => (tag as Record<string, unknown>)[key] === value) as
    | Record<string, string>
    | undefined;
}

function findTitle(meta: ReturnType<typeof buildPageSeo>["meta"]) {
  return meta.find((tag) => "title" in tag) as { title: string } | undefined;
}

describe("buildCanonicalUrl", () => {
  it("prepends the public origin to absolute pathnames", () => {
    expect(buildCanonicalUrl("/ui/docs/components/button")).toBe(
      `${PUBLIC_ORIGIN}/ui/docs/components/button`,
    );
  });

  it("normalises relative pathnames into absolute ones before joining", () => {
    expect(buildCanonicalUrl("ui/docs")).toBe(`${PUBLIC_ORIGIN}/ui/docs`);
  });
});

describe("buildPageSeo", () => {
  it("emits a title, canonical link, and the required SEO meta tags", () => {
    const seo = buildPageSeo({
      title: "Button - UI Docs",
      description: "Button primitive",
      pathname: "/ui/docs/components/button",
    });

    expect(findTitle(seo.meta)?.title).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "name", "description")?.content).toBe("Button primitive");
    expect(findMeta(seo.meta, "property", "og:title")?.content).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "property", "og:description")?.content).toBe("Button primitive");
    expect(findMeta(seo.meta, "property", "og:type")?.content).toBe("article");
    expect(findMeta(seo.meta, "property", "og:url")?.content).toBe(
      `${PUBLIC_ORIGIN}/ui/docs/components/button`,
    );
    expect(findMeta(seo.meta, "property", "og:site_name")?.content).toBe(DEFAULT_SITE_NAME);
    expect(findMeta(seo.meta, "name", "twitter:card")?.content).toBe("summary");
    expect(findMeta(seo.meta, "name", "twitter:title")?.content).toBe("Button - UI Docs");
    expect(findMeta(seo.meta, "name", "twitter:description")?.content).toBe("Button primitive");

    const canonical = seo.links.find((link) => link.rel === "canonical");
    expect(canonical?.href).toBe(`${PUBLIC_ORIGIN}/ui/docs/components/button`);
  });

  it("falls back to the default site description when no per-page description is given", () => {
    const seo = buildPageSeo({
      title: "Library Index",
      pathname: "/ui/docs",
    });

    expect(findMeta(seo.meta, "name", "description")?.content).toBe(DEFAULT_SITE_DESCRIPTION);
    expect(findMeta(seo.meta, "property", "og:description")?.content).toBe(DEFAULT_SITE_DESCRIPTION);
    expect(findMeta(seo.meta, "name", "twitter:description")?.content).toBe(DEFAULT_SITE_DESCRIPTION);
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
    expect(findMeta(meta, "name", "theme-color")?.content).toBe("#000000");
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

  it("includes a root canonical link and og:url from PUBLIC_ORIGIN", () => {
    const { meta, links } = buildRootHeadDefaults();

    const canonical = links.find((link) => link.rel === "canonical");
    expect(canonical?.href).toBe(PUBLIC_ORIGIN);

    expect(findMeta(meta, "property", "og:url")?.content).toBe(PUBLIC_ORIGIN);
  });
});
