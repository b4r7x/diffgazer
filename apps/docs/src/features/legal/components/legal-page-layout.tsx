import { Panel } from "@diffgazer/ui/components/panel";
import type { ReactNode } from "react";
import { SidebarPanelHeaderRow } from "@/components/layout/sidebar-panel-header";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
import { LegalSidebar } from "./legal-sidebar";
import { LegalSidebarHeader } from "./legal-sidebar-header";

export interface LegalPageLayoutProps {
  panelLabel: string;
  children: ReactNode;
}

export function LegalPageLayout({ panelLabel, children }: LegalPageLayoutProps) {
  return (
    <TuiTwoPane
      contentInPanel={false}
      sidebar={() => <LegalSidebar />}
      sidebarHeader={<LegalSidebarHeader />}
    >
      <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Panel frame="hairline" className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border bg-[var(--tui-chrome-band-bg)]">
            <SidebarPanelHeaderRow>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                [ LEGAL / {panelLabel} ]
              </span>
            </SidebarPanelHeaderRow>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-10">{children}</div>
        </Panel>
      </main>
    </TuiTwoPane>
  );
}
