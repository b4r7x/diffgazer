import { notFound } from "@tanstack/react-router";
import type { LegalPageLoaderData } from "@/features/legal/lib/load-legal-page";
import { buildPageSeo, DEFAULT_SITE_NAME } from "@/lib/seo";
import type { LegalPageSlug } from "./legal-slugs";

export const LEGAL_PAGES = [
  { slug: "privacy", path: "/privacy", panelLabel: "PRIVACY", label: "Privacy" },
  { slug: "terms", path: "/terms", panelLabel: "TERMS", label: "Terms" },
] as const satisfies readonly {
  slug: LegalPageSlug;
  path: string;
  panelLabel: string;
  label: string;
}[];

export type LegalPageEntry = (typeof LEGAL_PAGES)[number];

export const LEGAL_LINKS = LEGAL_PAGES.map(({ slug, label, path }) => ({ slug, label, to: path }));

export function getLegalPageEntry(slug: LegalPageSlug): LegalPageEntry {
  const entry = LEGAL_PAGES.find((page) => page.slug === slug);
  if (!entry) throw new Error(`Unknown legal page: ${slug}`);
  return entry;
}

export function legalRouteOptions(slug: LegalPageSlug) {
  const page = getLegalPageEntry(slug);
  return {
    loader: async (): Promise<LegalPageLoaderData> => {
      const { loadLegalPage } = await import("@/features/legal/lib/load-legal-page");
      const data = await loadLegalPage({ data: { slug } });
      if (!data) throw notFound();

      if (typeof window !== "undefined") {
        // Dynamic import: a static one would close a module cycle back into
        // this file (legal-page-view → legal-page-layout → legal-sidebar →
        // LEGAL_LINKS) and TDZ at SSR module init.
        const { legalClientLoader } = await import("@/features/legal/components/legal-page-view");
        await legalClientLoader.preload(data.path);
      }

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
