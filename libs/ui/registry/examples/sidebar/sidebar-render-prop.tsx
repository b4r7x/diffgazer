import type { Ref } from "react"
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
} from "@/components/ui/sidebar"

export default function SidebarRenderProp() {
  return (
    <Sidebar className="h-full">
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
