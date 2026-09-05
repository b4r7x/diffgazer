import type { DetailedHTMLProps, LinkHTMLAttributes, MetaHTMLAttributes } from "react";
import { resolvePublicOrigin } from "./public-origin";

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
  return resolvePublicOrigin(raw);
})();

export const DEFAULT_SITE_NAME = "diffgazer docs";
export const DEFAULT_SITE_DESCRIPTION =
  "Unified documentation for diffgazer libraries and UI primitives.";

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
  // Frontmatter descriptions are markdown: the page header typesets their code
  // spans as chips, and meta tags take the same prose without the delimiters.
  const resolvedDescription = description?.replaceAll("`", "") ?? DEFAULT_SITE_DESCRIPTION;

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
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    { title: DEFAULT_SITE_NAME },
    { name: "description", content: DEFAULT_SITE_DESCRIPTION },
    { property: "og:site_name", content: DEFAULT_SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:url", content: PUBLIC_ORIGIN },
    { property: "og:title", content: DEFAULT_SITE_NAME },
    { property: "og:description", content: DEFAULT_SITE_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: DEFAULT_SITE_NAME },
    { name: "twitter:description", content: DEFAULT_SITE_DESCRIPTION },
    { property: "og:image", content: `${PUBLIC_ORIGIN}/icon-512.png` },
  ];

  const links: LinkTag[] = [
    { rel: "manifest", href: "/manifest.json" },
    // The ICO declares its size so browsers that render SVG favicons prefer the
    // SVG (it follows dark browser chrome); Safari ignores the SVG and takes the ICO.
    { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  ];

  return { meta, links };
}
