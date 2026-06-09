import {
  SidebarPanelHeader,
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "@/components/layout/sidebar-panel-header";

export function LegalSidebarHeader() {
  return (
    <SidebarPanelHeader>
      <SidebarPanelHeaderRow>
        <SidebarPanelHeaderLabel>NAV</SidebarPanelHeaderLabel>
        <span className="truncate font-mono text-xs font-bold text-foreground">LEGAL</span>
      </SidebarPanelHeaderRow>
    </SidebarPanelHeader>
  );
}
