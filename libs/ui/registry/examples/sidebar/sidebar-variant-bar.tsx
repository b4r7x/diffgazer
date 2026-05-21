import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
  SidebarItemLabel,
  SidebarItemBadge,
} from "@/components/ui/sidebar"

export default function SidebarVariantBar() {
  return (
    <Sidebar variant="bar" className="w-64 h-80 border border-border bg-background">
      <SidebarHeader>
        <span className="text-xs font-mono text-muted-foreground">~/ui/docs</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>getting-started</SidebarSectionTitle>
          <SidebarItem>install</SidebarItem>
          <SidebarItem>quickstart</SidebarItem>
          <SidebarItem>theming</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>primitives</SidebarSectionTitle>
          <SidebarItem>
            <SidebarItemLabel>dialog</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">12</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem active>toggle-group</SidebarItem>
          <SidebarItem>
            <SidebarItemLabel>stepper</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">new</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem>sidebar</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>cli</SidebarSectionTitle>
          <SidebarItem>add</SidebarItem>
          <SidebarItem>remove</SidebarItem>
          <SidebarItem>diff</SidebarItem>
        </SidebarSection>
      </SidebarContent>
    </Sidebar>
  )
}
