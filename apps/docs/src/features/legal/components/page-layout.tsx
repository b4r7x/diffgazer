import { Button } from "@diffgazer/ui/components/button";
import type { ReactNode } from "react";
import { SidebarNavHeader } from "@/components/layout/sidebar-nav-header";
import {
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "@/components/layout/sidebar-panel-header";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { LegalSidebar } from "./legal-sidebar";

export interface LegalPageLayoutProps {
  panelLabel: string;
  children: ReactNode;
}

export function LegalPageLayout({ panelLabel, children }: LegalPageLayoutProps) {
  return (
    <TuiTwoPane
      sidebar={(closeSidebar) => <LegalSidebar onNavigate={closeSidebar} />}
      sidebarHeader={<SidebarNavHeader label="LEGAL" />}
    >
      <div className="shrink-0 border-b border-border bg-background">
        <SidebarPanelHeaderRow>
          <SidebarPanelHeaderLabel>[ LEGAL / {panelLabel} ]</SidebarPanelHeaderLabel>
        </SidebarPanelHeaderRow>
      </div>
      <main
        id="main-content"
        tabIndex={-1}
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
          {children}
        </ErrorBoundary>
      </main>
    </TuiTwoPane>
  );
}
