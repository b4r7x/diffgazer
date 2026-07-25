"use client";

import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarProvider,
  SidebarSection,
  SidebarSectionTitle,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function NavBody() {
  return (
    <>
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
    </>
  );
}

function Pane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Renders the sidebar in its mobile sheet mode. `breakpoint={9999}` forces
 * `isMobile=true` so the sheet branch renders regardless of viewport width —
 * useful for previewing the mobile experience on a docs page. In real apps
 * leave `breakpoint` at the default (1024) and let the viewport drive it.
 * `shortcutKey={null}` releases the global Cmd/Ctrl+B hotkey so the sheet
 * does not pop open when several sidebar demos share one docs page.
 *
 * The left pane renders the same nav with `embedded` so the sheet body stays
 * visible at rest: the sheet is a Dialog and only exists while open, which a
 * static page cannot show without trapping focus on load.
 */
export default function SidebarMobileSheet() {
  return (
    <div className="flex flex-wrap items-start gap-6 p-4 bg-background">
      <Pane label="sheet body (86vw, max 320px)">
        <div className="h-80 w-[280px] overflow-hidden border border-border">
          <SidebarProvider breakpoint={9999} shortcutKey={null}>
            <Sidebar embedded variant="caret" aria-label="Sheet navigation" className="w-full">
              <NavBody />
            </Sidebar>
          </SidebarProvider>
        </div>
      </Pane>

      <Pane label="closed — tap the trigger">
        <SidebarProvider breakpoint={9999} defaultState="hidden" shortcutKey={null}>
          <div className="flex max-w-[280px] flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <SidebarTrigger className="border border-border px-2 py-1" />
              <span>~/ui/docs</span>
            </div>
            <Sidebar variant="caret" aria-label="Primary navigation">
              <NavBody />
            </Sidebar>
            <p className="text-xs text-muted-foreground font-mono">
              Tap [≡] to open the sheet over the page. ESC or an outside click closes it and returns
              focus to the trigger.
            </p>
          </div>
        </SidebarProvider>
      </Pane>
    </div>
  );
}
