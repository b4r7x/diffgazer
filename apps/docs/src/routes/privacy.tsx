import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView } from "@/features/legal/components/legal-page-view";
import { getLegalPageEntry, legalRouteOptions } from "@/features/legal/lib/legal-pages";

const page = getLegalPageEntry("privacy");

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  ...legalRouteOptions(page.slug),
});

function PrivacyPage() {
  const data = Route.useLoaderData();
  return <LegalPageView data={data} panelLabel={page.panelLabel} />;
}
