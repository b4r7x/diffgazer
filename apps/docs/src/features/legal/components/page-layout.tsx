import { Button } from "@diffgazer/ui/components/button";
import { ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArticleSkeleton } from "@/components/article-skeleton";
import { SidebarNavHeader } from "@/components/layout/sidebar-nav-header";
import {
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "@/components/layout/sidebar-panel-header";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useIsLegalRoutePending } from "@/features/legal/hooks/use-pending-route";
import { MAIN_SCROLL_INIT_SCRIPT } from "@/lib/main-scroll-bootstrap";
import { MAIN_SCROLL_RESTORATION_ID } from "@/lib/main-scroll-restoration";
import { LegalSidebar } from "./sidebar";

export interface LegalPageLayoutProps {
  panelLabel: string;
  children: ReactNode;
}

export function LegalPageLayout({ panelLabel, children }: LegalPageLayoutProps) {
  const isPending = useIsLegalRoutePending();

  return (
    <TuiTwoPane
      sidebar={(closeSidebar) => <LegalSidebar onNavigate={closeSidebar} />}
      sidebarHeader={<SidebarNavHeader label="LEGAL" />}
    >
      <div className="shrink-0 border-b border-border bg-background">
        <SidebarPanelHeaderRow>
          <SidebarPanelHeaderLabel>
            [ LEGAL / {isPending ? "LOADING" : panelLabel} ]
          </SidebarPanelHeaderLabel>
        </SidebarPanelHeaderRow>
      </div>
      <main
        id="main-content"
        data-scroll-restoration-id={MAIN_SCROLL_RESTORATION_ID}
        tabIndex={-1}
        aria-busy={isPending}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin px-6 py-10 outline-hidden"
      >
        <ErrorBoundary
          key={panelLabel}
          fallback={
            <TuiFaultPanel
              statusCode="ERR_LEGAL_CONTENT"
              title="Legal page unavailable"
              description="The page content could not be loaded. Reload to try again."
              actionLabel="RELOAD"
              primaryAction={
                <Button variant="primary" bracket onClick={() => globalThis.location.reload()}>
                  Reload
                </Button>
              }
            />
          }
        >
          {isPending ? <LegalPageLoadingFrame /> : children}
        </ErrorBoundary>
        <ScriptOnce>{MAIN_SCROLL_INIT_SCRIPT}</ScriptOnce>
      </main>
    </TuiTwoPane>
  );
}

function LegalPageLoadingFrame() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <ArticleSkeleton label="Loading legal page" />
    </section>
  );
}
