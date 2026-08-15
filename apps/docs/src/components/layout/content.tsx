import { ScriptOnce, useLocation, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { DocsPageLoadingFrame } from "@/components/page-layout";
import { DocsTreeProvider } from "@/hooks/docs-tree-context";
import { useDocsHistory, useDocsSearchScope } from "@/hooks/search-context";
import { usePendingDocsRoute } from "@/hooks/use-pending-docs-route";
import type { DocsLibraryId } from "@/lib/library";
import { MAIN_SCROLL_INIT_SCRIPT } from "@/lib/main-scroll-bootstrap";
import { MAIN_SCROLL_RESTORATION_ID } from "@/lib/main-scroll-restoration";
import {
  collectLandingSections,
  findPageByUrl,
  findTreeSectionPath,
  type PageTree,
} from "@/lib/page-tree";
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
  const pathname = useLocation({ select: (location) => location.pathname });
  const pendingDocsPathname = usePendingDocsRoute();
  const isDocsRoutePending = pendingDocsPathname !== null;
  const { recordVisit } = useDocsHistory();
  const { setScope } = useDocsSearchScope();

  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", () => {
      // Focusing a scroller drags it to wherever the focus ring lands, which would
      // undo the offset the router just restored (or the anchor it just jumped to).
      mainRef.current?.focus({ preventScroll: true });
    });
    return unsubscribe;
  }, [router]);

  // The reader's own trail feeds the search launcher's Recent group.
  useEffect(() => {
    const page = findPageByUrl(tree, pathname);
    if (!page) return;
    recordVisit({
      title: page.name,
      url: page.url,
      section: findTreeSectionPath(tree, pathname)[0] ?? tree.name,
    });
  }, [pathname, tree, recordVisit]);

  // The launcher's Jump group offers the section indexes of the library that
  // owns the current route; the dialog lives at the root, above this shell.
  useEffect(() => {
    setScope({
      library,
      sections: collectLandingSections(tree).flatMap((section) => {
        const index = section.items[0];
        return index ? [{ name: section.name, url: index.url }] : [];
      }),
    });
    return () => setScope(null);
  }, [tree, library, setScope]);

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
        data-scroll-restoration-id={MAIN_SCROLL_RESTORATION_ID}
        tabIndex={-1}
        aria-busy={isDocsRoutePending}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin outline-hidden transition-opacity duration-150 aria-busy:opacity-60"
      >
        {/* The page header owns the path row (one scope line above the title);
            the tree travels by context because the header is rendered by the
            route, several levels below this shell. */}
        <div className="mx-auto flex min-h-full max-w-7xl flex-col px-6 py-10">
          <DocsTreeProvider tree={tree}>
            {isDocsRoutePending ? <DocsPageLoadingFrame /> : children}
          </DocsTreeProvider>
        </div>
        <ScriptOnce>{MAIN_SCROLL_INIT_SCRIPT}</ScriptOnce>
      </main>
    </TuiTwoPane>
  );
}
