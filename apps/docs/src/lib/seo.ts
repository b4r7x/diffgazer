import type { DetailedHTMLProps, LinkHTMLAttributes, MetaHTMLAttributes } from "react";

const DEFAULT_ORIGIN = "https://docs.b4r7.dev";

/**
 * This module is isomorphic: it runs during server prerender (Nitro/Node) and
 * in the browser bundle. `process.env` is the runtime source on the server;
 * `import.meta.env` is statically inlined by Vite for the client build. Reading
 * `process.env` first lets the deployed server override the build-time value
 * without rebuilding, then falls back to the client-inlined value.
 */
export const PUBLIC_ORIGIN: string = (() => {
  const raw =
    (typeof process !== "undefined" ? process.env.VITE_PUBLIC_ORIGIN : undefined) ??
    import.meta.env.VITE_PUBLIC_ORIGIN;
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_ORIGIN;
  return raw.replace(/\/+$/, "");
})();

export const DEFAULT_SITE_NAME = "diffgazer docs";
export const DEFAULT_SITE_DESCRIPTION =
  "Unified documentation for diffgazer libraries and UI primitives.";
// Matches the lib --base-bg dark value so the browser/PWA chrome aligns with the page.
export const DEFAULT_THEME_COLOR = "#0a0a0a";

type MetaTag =
  | { title: string }
  | (DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement> & {
      property?: string;
    });

type LinkTag = DetailedHTMLProps<LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;

export interface PageSeoInput {
  title: string;
  description?: string;
  pathname: string;
  type?: "website" | "article";
}

export interface PageSeoOutput {
  meta: MetaTag[];
  links: LinkTag[];
}

export function buildCanonicalUrl(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${PUBLIC_ORIGIN}${normalized}`;
}

export function buildPageSeo({
  title,
  description,
  pathname,
  type = "article",
}: PageSeoInput): PageSeoOutput {
  const canonical = buildCanonicalUrl(pathname);
  const resolvedDescription = description ?? DEFAULT_SITE_DESCRIPTION;

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: resolvedDescription },
    { property: "og:title", content: title },
    { property: "og:description", content: resolvedDescription },
    { property: "og:type", content: type },
    { property: "og:url", content: canonical },
    { property: "og:site_name", content: DEFAULT_SITE_NAME },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: resolvedDescription },
  ];

  const links: LinkTag[] = [{ rel: "canonical", href: canonical }];

  return { meta, links };
}

export function buildRootHeadDefaults(): { meta: MetaTag[]; links: LinkTag[] } {
  const meta: MetaTag[] = [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title: DEFAULT_SITE_NAME },
    { name: "description", content: DEFAULT_SITE_DESCRIPTION },
    { name: "theme-color", content: DEFAULT_THEME_COLOR },
    { property: "og:site_name", content: DEFAULT_SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:url", content: PUBLIC_ORIGIN },
    { property: "og:title", content: DEFAULT_SITE_NAME },
    { property: "og:description", content: DEFAULT_SITE_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: DEFAULT_SITE_NAME },
    { name: "twitter:description", content: DEFAULT_SITE_DESCRIPTION },
    { property: "og:image", content: `${PUBLIC_ORIGIN}/logo512.png` },
  ];

  const links: LinkTag[] = [
    { rel: "manifest", href: "/manifest.json" },
    { rel: "icon", href: "/favicon.ico" },
    { rel: "apple-touch-icon", href: "/logo192.png" },
  ];

  return { meta, links };
}
