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

// Stand-in for the app content the rail sits next to — the tri-state (open,
// rail, hidden) is only judgeable against a populated pane.
const CONTENT_ROWS = [
  { name: "registry/ui/sidebar/sidebar.tsx", meta: "M  +42 −8" },
  { name: "registry/ui/sidebar/sidebar-item.tsx", meta: "M  +12 −3" },
  { name: "registry/ui/sidebar/sidebar.css", meta: "A  +64 −0" },
  { name: "docs/content/components/sidebar.mdx", meta: "M  +9 −9" },
];

// In rail mode (48px) each item collapses to an icon-only row: the label and
// section titles hide via the nav's `data-state="rail"` group while the glyph
// tile stays visible. SidebarItem preserves the accessible name automatically
// by rendering an sr-only copy of the label while collapsed; `title` only adds
// the native hover tooltip.
export default function SidebarRail() {
  return (
    <SidebarProvider defaultState="rail">
      <div className="flex items-stretch h-80 bg-background">
        <Sidebar embedded variant="bar">
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
        <div className="flex min-w-0 flex-1 flex-col gap-3 border-l border-border p-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="border border-border px-2 py-1" />
            <span className="truncate">~/diffgazer/libs/ui</span>
          </div>
          <ul className="flex flex-col gap-1">
            {CONTENT_ROWS.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-4">
                <span className="truncate text-foreground/80">{row.name}</span>
                <span className="shrink-0">{row.meta}</span>
              </li>
            ))}
          </ul>
          <p>
            Toggle the rail with the trigger or <Kbd size="sm">Cmd/Ctrl</Kbd>
            <Kbd size="sm">B</Kbd>; <Kbd size="sm">Shift</Kbd>
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
