"use client";

import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarItemLabel,
  SidebarProvider,
  SidebarSection,
  SidebarSectionTitle,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// In rail mode (48px), each item collapses to an icon-only row centered in the
// rail. `<SidebarItemLabel>` is hidden via the nav's `data-state="rail"`
// group; the icon stand-in (any first child that is not a label/badge) stays
// visible. Section titles and the variant glyph (▸) also hide. The `title`
// attribute on `<SidebarItem>` preserves the accessible name and drives the
// native tooltip on hover.
export default function SidebarRail() {
  return (
    <SidebarProvider defaultState="rail">
      <div className="flex items-stretch h-80 bg-background">
        <Sidebar variant="block">
          <SidebarHeader>
            <span className="text-xs font-mono font-bold">DG</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarSection>
              <SidebarSectionTitle>getting-started</SidebarSectionTitle>
              <SidebarItem title="install">
                <RailIcon>i</RailIcon>
                <SidebarItemLabel>install</SidebarItemLabel>
              </SidebarItem>
              <SidebarItem active title="quickstart">
                <RailIcon>q</RailIcon>
                <SidebarItemLabel>quickstart</SidebarItemLabel>
              </SidebarItem>
              <SidebarItem title="theming">
                <RailIcon>t</RailIcon>
                <SidebarItemLabel>theming</SidebarItemLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSection>
              <SidebarSectionTitle>primitives</SidebarSectionTitle>
              <SidebarItem title="dialog">
                <RailIcon>D</RailIcon>
                <SidebarItemLabel>dialog</SidebarItemLabel>
              </SidebarItem>
              <SidebarItem title="toggle-group">
                <RailIcon>T</RailIcon>
                <SidebarItemLabel>toggle-group</SidebarItemLabel>
              </SidebarItem>
              <SidebarItem title="stepper">
                <RailIcon>S</RailIcon>
                <SidebarItemLabel>stepper</SidebarItemLabel>
              </SidebarItem>
              <SidebarItem title="sidebar">
                <RailIcon>N</RailIcon>
                <SidebarItemLabel>sidebar</SidebarItemLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col gap-2 p-4 text-xs text-muted-foreground font-mono">
          <SidebarTrigger className="self-start border border-border px-2 py-1" />
          <p>Toggle the rail with the trigger or <Kbd size="sm">Cmd/Ctrl</Kbd><Kbd size="sm">B</Kbd>.</p>
          <p><Kbd size="sm">Shift</Kbd><Kbd size="sm">Cmd/Ctrl</Kbd><Kbd size="sm">B</Kbd> toggles the hidden state.</p>
        </div>
      </div>
    </SidebarProvider>
  )
}

// Single-letter icon stand-in matching the R1 preview. Real consumers replace
// with Lucide / inline SVG; the 4ch width holds the icon centered without
// shifting layout when label/glyph show in `open` state.
function RailIcon({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center justify-center w-4 text-foreground font-bold">
      {children}
    </span>
  )
}
