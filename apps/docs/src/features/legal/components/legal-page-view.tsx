import browserCollections from "fumadocs-mdx:collections/browser";
import { Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import { DocsPageBody, DocsPageHeader } from "@/components/page-layout";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import type { LegalPageLoaderData } from "@/features/legal/lib/load-legal-page";
import { useMDXComponents } from "@/mdx-components";
import { LegalPageLayout } from "./legal-page-layout";

export const legalClientLoader = browserCollections.legal.createClientLoader({
  component({ frontmatter, default: MDX }) {
    const title = frontmatter.title;
    const description = frontmatter.description;

    return (
      <>
        <DocsPageHeader title={title} description={description} />
        <DocsPageBody>
          <MDX components={useMDXComponents()} />
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
    <LegalPageLayout panelLabel={panelLabel}>
      <Suspense fallback={<ContentSpinner />}>
        <LegalMdxContent path={data.path} lastUpdated={data.lastUpdated} />
      </Suspense>
    </LegalPageLayout>
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
