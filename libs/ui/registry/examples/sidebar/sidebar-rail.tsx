"use client";

import { Kbd } from "@/components/ui/kbd";
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
} from "@/components/ui/sidebar";

// In rail mode (48px) each item collapses to an icon-only row: the label and
// section titles hide via the nav's `data-state="rail"` group while the glyph
// tile stays visible. SidebarItem preserves the accessible name automatically
// by rendering an sr-only copy of the label while collapsed; `title` only adds
// the native hover tooltip.
export default function SidebarRail() {
  return (
    <SidebarProvider defaultState="rail">
      <div className="flex items-stretch h-80 bg-background">
        <Sidebar variant="bar">
          <SidebarHeader>
            <span className="text-xs font-mono font-bold">DG</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarSection>
              <SidebarSectionTitle>getting-started</SidebarSectionTitle>
              <RailItem glyph="↓" label="install" />
              <RailItem glyph="»" label="quickstart" active />
              <RailItem glyph="◐" label="theming" />
            </SidebarSection>
            <SidebarSection>
              <SidebarSectionTitle>cli</SidebarSectionTitle>
              <RailItem glyph="+" label="add" />
              <RailItem glyph="−" label="remove" />
              <RailItem glyph="±" label="diff" />
            </SidebarSection>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col gap-2 p-4 text-xs text-muted-foreground font-mono">
          <SidebarTrigger className="self-start border border-border px-2 py-1" />
          <p>
            Toggle the rail with the trigger or <Kbd size="sm">Cmd/Ctrl</Kbd>
            <Kbd size="sm">B</Kbd>.
          </p>
          <p>
            <Kbd size="sm">Shift</Kbd>
            <Kbd size="sm">Cmd/Ctrl</Kbd>
            <Kbd size="sm">B</Kbd> toggles the hidden state.
          </p>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Glyph tile icon stand-in — swap for Lucide / inline SVG in real consumers.
function RailItem({ glyph, label, active }: { glyph: string; label: string; active?: boolean }) {
  return (
    <SidebarItem active={active} title={label}>
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border"
      >
        {glyph}
      </span>
      <SidebarItemLabel>{label}</SidebarItemLabel>
    </SidebarItem>
  );
}
