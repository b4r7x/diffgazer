import { createFileRoute } from "@tanstack/react-router";
import { LegalPageView } from "@/features/legal/components/page-view";
import { getLegalPageEntry, legalRouteOptions } from "@/features/legal/lib/pages";

const page = getLegalPageEntry("terms");

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  ...legalRouteOptions(page.slug),
});

function TermsPage() {
  const data = Route.useLoaderData();
  return <LegalPageView data={data} panelLabel={page.panelLabel} />;
}
