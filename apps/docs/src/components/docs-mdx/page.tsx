import { Button } from "@diffgazer/ui/components/button";
import { type ReactNode, Suspense } from "react";
import {
  type ComponentPageData,
  type DocData,
  DocDataProvider,
  type HookPageData,
} from "@/components/docs-mdx/doc-data-context";
import { DocsContentLayout } from "@/components/layout/content";
import { DocsFooterPager } from "@/components/layout/footer-pager";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { MdxPreloadMarker } from "@/components/mdx-preload-marker";
import { DocsPageLoadingFrame } from "@/components/page-layout";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import type { DocsLibraryId } from "@/lib/library";
import type { PageTree } from "@/lib/page-tree";

function buildDocData(
  componentData: ComponentPageData | null,
  hookData: HookPageData | null,
): DocData | null {
  if (componentData) return { type: "component", data: componentData };
  if (hookData) return { type: "hook", data: hookData };
  return null;
}

export function MdxDocsPage({
  path,
  pageUrl,
  tree,
  library,
  componentData,
  hookData,
  children,
}: {
  path: string;
  pageUrl: string;
  tree: PageTree;
  library: DocsLibraryId;
  componentData: ComponentPageData | null;
  hookData: HookPageData | null;
  children: ReactNode;
}) {
  const docData = buildDocData(componentData, hookData);

  return (
    <>
      <MdxPreloadMarker collection="docs" path={path} />
      <DocsContentLayout tree={tree} library={library}>
        <DocDataProvider value={docData}>
          <ErrorBoundary
            key={path}
            fallback={
              <TuiFaultPanel
                statusCode="ERR_DOC_CONTENT"
                title="Documentation page unavailable"
                description="The page content could not be loaded. Reload to try again."
                actionLabel="RELOAD_PAGE"
                primaryAction={
                  <Button variant="primary" bracket onClick={() => globalThis.location.reload()}>
                    Reload page
                  </Button>
                }
              />
            }
          >
            <Suspense fallback={<DocsPageLoadingFrame />}>{children}</Suspense>
          </ErrorBoundary>
        </DocDataProvider>
        <DocsFooterPager pageUrl={pageUrl} tree={tree} library={library} />
      </DocsContentLayout>
    </>
  );
}
