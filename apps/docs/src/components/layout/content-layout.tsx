import { cn } from "@diffgazer/ui/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { usePendingDocsRoute } from "@/hooks/use-pending-docs-route";
import type { DocsLibraryId } from "@/lib/library";
import type { PageTree } from "@/lib/page-tree";
import { DocsSidebar } from "./sidebar";
import { SidebarChrome } from "./sidebar-chrome";
import { TuiTwoPane } from "./tui-two-pane";

export interface DocsContentLayoutProps {
  tree: PageTree;
  library: DocsLibraryId;
  children: ReactNode;
}

export function DocsContentLayout({ tree, library, children }: DocsContentLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pendingDocsPathname = usePendingDocsRoute();
  const isDocsRoutePending = pendingDocsPathname !== null;

  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", () => {
      mainRef.current?.focus();
    });
    return unsubscribe;
  }, [router]);

  return (
    <TuiTwoPane
      sidebar={(closeSidebar) => (
        <DocsSidebar tree={tree} library={library} onNavigate={closeSidebar} />
      )}
      sidebarHeader={<SidebarChrome library={library} tree={tree} />}
      sidebarBusy={isDocsRoutePending}
    >
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-busy={isDocsRoutePending}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin outline-hidden transition-opacity duration-150 aria-busy:opacity-60"
      >
        <div className="mx-auto flex min-h-full max-w-7xl flex-col px-6 py-10">
          <div className={cn("mb-4 flex items-center gap-2 lg:hidden", CHROME_LABEL_CLASS)}>
            <span className="shrink-0">Path</span>
            <Breadcrumbs tree={tree} className="min-w-0 flex-1" />
          </div>
          {children}
        </div>
      </main>
    </TuiTwoPane>
  );
}
