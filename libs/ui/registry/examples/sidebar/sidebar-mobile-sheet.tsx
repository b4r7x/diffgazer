"use client";

import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"

/**
 * Renders the sidebar in its mobile sheet mode. `breakpoint={9999}` forces
 * `isMobile=true` so the sheet branch renders regardless of viewport width —
 * useful for previewing the mobile experience on a docs page. In real apps
 * leave `breakpoint` at the default (1024) and let the viewport drive it.
 */
export default function SidebarMobileSheet() {
  return (
    <SidebarProvider breakpoint={9999} defaultState="hidden">
      <div className="flex flex-col gap-3 border border-border p-4 bg-background">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <SidebarTrigger className="border border-border px-2 py-1" />
          <span>~/ui/docs</span>
        </div>
        <Sidebar variant="caret" aria-label="Primary navigation">
          <SidebarHeader>
            <span className="text-xs font-mono font-bold">~/ui/docs</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarSection>
              <SidebarSectionTitle>primitives</SidebarSectionTitle>
              <SidebarItem>dialog</SidebarItem>
              <SidebarItem>toggle-group</SidebarItem>
              <SidebarItem active>stepper</SidebarItem>
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
        <p className="text-xs text-muted-foreground font-mono">
          Tap [≡] to open the sheet. ESC or outside click closes it.
        </p>
      </div>
    </SidebarProvider>
  )
}
