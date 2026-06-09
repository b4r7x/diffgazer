import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  legalClientLoader,
  LegalPageView,
} from "@/features/legal/components/legal-page-view";
import { loadLegalPage } from "@/features/legal/lib/load-legal-page";
import { buildPageSeo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  loader: async () => {
    const data = await loadLegalPage({ data: { slug: "privacy" } });
    if (!data) throw notFound();

    if (typeof window !== "undefined") {
      await legalClientLoader.preload(data.path);
    }

    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const seo = buildPageSeo({
      title: `${loaderData.title} - diffgazer docs`,
      description: loaderData.description,
      pathname: "/privacy",
    });
    return { meta: seo.meta, links: seo.links };
  },
});

function PrivacyPage() {
  const data = Route.useLoaderData();
  return <LegalPageView data={data} panelLabel="PRIVACY" />;
}
