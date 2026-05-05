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

export default function SidebarRenderProp() {
  return (
    <Sidebar className="w-64 border border-border rounded bg-background">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">Navigation</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>Pages</SidebarSectionTitle>
          <SidebarItem active>
            {({ className, "aria-current": ariaCurrent }) => (
              <a href="/dashboard" className={className} aria-current={ariaCurrent}>
                <SidebarItemLabel>Dashboard</SidebarItemLabel>
                <SidebarItemBadge>
                  <span className="text-xs text-muted-foreground">3</span>
                </SidebarItemBadge>
              </a>
            )}
          </SidebarItem>
          <SidebarItem>
            {({ className }) => (
              <a href="/settings" className={className}>
                <SidebarItemLabel>Settings</SidebarItemLabel>
              </a>
            )}
          </SidebarItem>
          <SidebarItem disabled>
            {({ className, disabled }) => (
              <a href="/admin" className={className} aria-disabled={disabled}>
                <SidebarItemLabel>Admin</SidebarItemLabel>
              </a>
            )}
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">Render prop pattern</span>
      </SidebarFooter>
    </Sidebar>
  )
}
