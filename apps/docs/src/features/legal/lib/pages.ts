import { notFound } from "@tanstack/react-router";
import type { LegalPageLoaderData } from "@/features/legal/lib/load-page";
import { buildPageSeo, DEFAULT_SITE_NAME } from "@/lib/seo";
import type { LegalPageSlug } from "./slugs";

// Keyed by slug so `slugs.ts` and this table cannot drift: a slug added there
// without a page here fails the mapped `satisfies`, and the key must equal the
// entry's own slug. That makes the lookup total — no runtime "unknown page".
const LEGAL_PAGE_BY_SLUG = {
  privacy: { slug: "privacy", path: "/privacy", panelLabel: "PRIVACY", label: "Privacy" },
  terms: { slug: "terms", path: "/terms", panelLabel: "TERMS", label: "Terms" },
} as const satisfies {
  [S in LegalPageSlug]: { slug: S; path: string; panelLabel: string; label: string };
};

export type LegalPageEntry = (typeof LEGAL_PAGE_BY_SLUG)[LegalPageSlug];

export const LEGAL_PAGES: readonly LegalPageEntry[] = Object.values(LEGAL_PAGE_BY_SLUG);

export const LEGAL_LINKS = LEGAL_PAGES.map(({ slug, label, path }) => ({ slug, label, to: path }));

export function getLegalPageEntry(slug: LegalPageSlug): LegalPageEntry {
  return LEGAL_PAGE_BY_SLUG[slug];
}

export function legalRouteOptions(
  slug: LegalPageSlug,
  preloadContent: (path: string) => Promise<unknown>,
) {
  const page = getLegalPageEntry(slug);
  return {
    loader: async (): Promise<LegalPageLoaderData> => {
      const { loadLegalPage } = await import("@/features/legal/lib/load-page");
      const data = await loadLegalPage({ data: { slug } });
      if (!data) throw notFound();
      await preloadContent(data.path);
      return data;
    },
    head: ({ loaderData }: { loaderData?: LegalPageLoaderData }) => {
      if (!loaderData) return {};
      const seo = buildPageSeo({
        title: `${loaderData.title} - ${DEFAULT_SITE_NAME}`,
        description: loaderData.description,
        pathname: page.path,
      });
      return { meta: seo.meta, links: seo.links };
    },
  };
}
