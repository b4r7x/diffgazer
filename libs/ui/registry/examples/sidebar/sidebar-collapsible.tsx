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

export default function SidebarCollapsible() {
  return (
    <Sidebar defaultCollapsed={false} className="w-64 border border-border rounded bg-background">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">File Browser</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>src/</SidebarSectionTitle>
          <SidebarItem active>index.ts</SidebarItem>
          <SidebarItem>utils.ts</SidebarItem>
          <SidebarItem>config.ts</SidebarItem>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen={false}>
          <SidebarSectionTitle>tests/</SidebarSectionTitle>
          <SidebarItem>index.test.ts</SidebarItem>
          <SidebarItem>utils.test.ts</SidebarItem>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>docs/</SidebarSectionTitle>
          <SidebarItem>
            <SidebarItemLabel>README.md</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">draft</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem>CHANGELOG.md</SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">3 sections</span>
      </SidebarFooter>
    </Sidebar>
  )
}
