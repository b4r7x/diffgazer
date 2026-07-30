import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView, legalClientLoader } from "@/features/legal/components/page-view";
import { getLegalPageEntry, legalRouteOptions } from "@/features/legal/lib/pages";

const page = getLegalPageEntry("privacy");

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  ...legalRouteOptions(page.slug, (path) => legalClientLoader.preload(path)),
});

function PrivacyPage() {
  const data = Route.useLoaderData();
  return <LegalPageView data={data} panelLabel={page.panelLabel} />;
}
