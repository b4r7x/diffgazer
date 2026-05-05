import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
  SidebarItemLabel,
  SidebarItemBadge,
  SidebarFooter,
} from "@/components/ui/sidebar"

export default function SidebarDefault() {
  return (
    <Sidebar className="w-64 border border-border rounded bg-background">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">Project Explorer</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>Components</SidebarSectionTitle>
          <SidebarItem active>Button</SidebarItem>
          <SidebarItem>Dialog</SidebarItem>
          <SidebarItem>
            <SidebarItemLabel>Sidebar</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">new</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem disabled>Tooltip</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>Hooks</SidebarSectionTitle>
          <SidebarItem>useTheme</SidebarItem>
          <SidebarItem>useMediaQuery</SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">v1.0.0</span>
      </SidebarFooter>
    </Sidebar>
  )
}
