import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemLabel,
  SidebarSection,
  SidebarSectionTitle,
} from "@/components/ui/sidebar";

export default function SidebarDefault() {
  return (
    <Sidebar className="h-full">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">Project Explorer</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>Components</SidebarSectionTitle>
          <SidebarItem active href="#button">
            Button
          </SidebarItem>
          <SidebarItem href="#dialog">Dialog</SidebarItem>
          <SidebarItem href="#sidebar">
            <SidebarItemLabel>Sidebar</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">new</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem disabled>Tooltip</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>Hooks</SidebarSectionTitle>
          <SidebarItem href="#use-theme">useTheme</SidebarItem>
          <SidebarItem href="#use-media-query">useMediaQuery</SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">v1.0.0</span>
      </SidebarFooter>
    </Sidebar>
  );
}
