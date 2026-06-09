import {
  SidebarPanelHeader,
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "./sidebar-panel-header";

export function HomeSidebarHeader() {
  return (
    <SidebarPanelHeader>
      <SidebarPanelHeaderRow>
        <SidebarPanelHeaderLabel>NAV</SidebarPanelHeaderLabel>
        <span className="truncate font-mono text-xs font-bold text-foreground">ROOT</span>
      </SidebarPanelHeaderRow>
    </SidebarPanelHeader>
  );
}
