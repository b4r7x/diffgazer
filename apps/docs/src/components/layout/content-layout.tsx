import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import type { DocsLibraryId } from "@/lib/library";
import type { PageTree } from "@/lib/page-tree";
import { usePendingDocsRoute } from "@/lib/use-pending-docs-route";
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
      sidebarHeader={<SidebarChrome library={library} />}
      sidebarBusy={isDocsRoutePending}
    >
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-busy={isDocsRoutePending}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin outline-hidden transition-opacity duration-150 aria-busy:opacity-60"
      >
        <div className="mx-auto flex min-h-full max-w-7xl flex-col px-6 py-10">{children}</div>
      </main>
    </TuiTwoPane>
  );
}
