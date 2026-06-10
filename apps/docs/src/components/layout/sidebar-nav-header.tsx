import {
  SidebarPanelHeader,
  SidebarPanelHeaderLabel,
  SidebarPanelHeaderRow,
} from "./sidebar-panel-header";

export function SidebarNavHeader({ label }: { label: string }) {
  return (
    <SidebarPanelHeader>
      <SidebarPanelHeaderRow>
        <SidebarPanelHeaderLabel>NAV</SidebarPanelHeaderLabel>
        <span className="truncate font-mono text-xs font-bold text-foreground">{label}</span>
      </SidebarPanelHeaderRow>
    </SidebarPanelHeader>
  );
}
