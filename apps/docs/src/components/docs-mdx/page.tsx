import { Button } from "@diffgazer/ui/components/button";
import { Component, type ReactNode, Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import {
  type ComponentPageData,
  type DocData,
  DocDataProvider,
  type HookPageData,
} from "@/components/docs-mdx/doc-data-context";
import { DocsContentLayout } from "@/components/layout/content-layout";
import { DocsFooterPager } from "@/components/layout/footer-pager";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { type DocsLibraryId } from "@/lib/library";
import { type PageTree } from "@/lib/page-tree";

function buildDocData(
  componentData: ComponentPageData | null,
  hookData: HookPageData | null,
): DocData | null {
  if (componentData) return { type: "component", data: componentData };
  if (hookData) return { type: "hook", data: hookData };
  return null;
}

class MdxContentErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
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
      );
    }
    return this.props.children;
  }
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
    <DocsContentLayout tree={tree} library={library}>
      <DocDataProvider value={docData}>
        <MdxContentErrorBoundary key={path}>
          <Suspense fallback={<ContentSpinner />}>{children}</Suspense>
        </MdxContentErrorBoundary>
      </DocDataProvider>
      <DocsFooterPager pageUrl={pageUrl} tree={tree} library={library} />
    </DocsContentLayout>
  );
}
