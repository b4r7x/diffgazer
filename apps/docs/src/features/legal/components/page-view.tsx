import browserCollections from "fumadocs-mdx:collections/browser";
import { Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import { markdownMdxComponents } from "@/components/docs-mdx/markdown-renderers";
import { MdxPreloadMarker } from "@/components/mdx-preload-marker";
import { DocsPageBody, DocsPageHeader } from "@/components/page-layout";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import type { LegalPageLoaderData } from "@/features/legal/lib/load-page";
import { LegalPageLayout } from "./page-layout";

export const legalClientLoader = browserCollections.legal.createClientLoader({
  component({ frontmatter, default: MDX }) {
    const title = frontmatter.title;
    const description = frontmatter.description;

    return (
      <>
        <DocsPageHeader title={title} description={description} />
        <DocsPageBody>
          {/* Legal prose is plain markdown: the app-tier docs registry (and the
              theme feature it pulls in) has no business in this feature. */}
          <MDX components={markdownMdxComponents} />
        </DocsPageBody>
      </>
    );
  },
});

export function LegalPageView({
  data,
  panelLabel,
}: {
  data: LegalPageLoaderData;
  panelLabel: string;
}) {
  return (
    <>
      <MdxPreloadMarker collection="legal" path={data.path} />
      <LegalPageLayout panelLabel={panelLabel}>
        <Suspense fallback={<ContentSpinner />}>
          <LegalMdxContent path={data.path} lastUpdated={data.lastUpdated} />
        </Suspense>
      </LegalPageLayout>
    </>
  );
}

function LegalMdxContent({ path, lastUpdated }: { path: string; lastUpdated?: string }) {
  return (
    <>
      {lastUpdated ? (
        <p className={`mb-6 ${CHROME_LABEL_CLASS}`}>Last updated: {lastUpdated}</p>
      ) : null}
      {legalClientLoader.useContent(path)}
    </>
  );
}
