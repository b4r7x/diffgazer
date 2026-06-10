import type { ReactNode } from "react";
import { SidebarNavHeader } from "@/components/layout/sidebar-nav-header";
import {
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "@/components/layout/sidebar-panel-header";
import { TuiTwoPane } from "@/components/layout/tui-two-pane";
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
      <div className="shrink-0 border-b border-border bg-[var(--tui-chrome-band-bg)]">
        <SidebarPanelHeaderRow>
          <SidebarPanelHeaderLabel>[ LEGAL / {panelLabel} ]</SidebarPanelHeaderLabel>
        </SidebarPanelHeaderRow>
      </div>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-10 outline-hidden"
      >
        {children}
      </main>
    </TuiTwoPane>
  );
}
