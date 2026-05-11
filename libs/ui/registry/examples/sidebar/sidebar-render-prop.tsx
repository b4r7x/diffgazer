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
import type { Ref } from "react"

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
            {({ ref, ...itemProps }) => (
              <a {...itemProps} ref={ref as Ref<HTMLAnchorElement>} href="/dashboard">
                <SidebarItemLabel>Dashboard</SidebarItemLabel>
                <SidebarItemBadge>
                  <span className="text-xs text-muted-foreground">3</span>
                </SidebarItemBadge>
              </a>
            )}
          </SidebarItem>
          <SidebarItem>
            {({ ref, ...itemProps }) => (
              <a {...itemProps} ref={ref as Ref<HTMLAnchorElement>} href="/settings">
                <SidebarItemLabel>Settings</SidebarItemLabel>
              </a>
            )}
          </SidebarItem>
          <SidebarItem disabled>
            {({ ref, disabled, ...itemProps }) => (
              <a {...itemProps} ref={ref as Ref<HTMLAnchorElement>} aria-disabled={disabled}>
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
