"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemLabel,
  SidebarSection,
  SidebarSectionTitle,
  type SidebarVariant,
} from "@/components/ui/sidebar";
import { ToggleGroup } from "@/components/ui/toggle-group";

const VARIANTS: { value: SidebarVariant; label: string }[] = [
  { value: "caret", label: "caret" },
  { value: "inverted", label: "inverted" },
  { value: "bar", label: "bar" },
  { value: "terminal", label: "terminal" },
  { value: "tree", label: "tree" },
];

export default function SidebarVariants() {
  const [variant, setVariant] = useState<SidebarVariant>("caret");

  return (
    // w-64 matches the sidebar so the demo stays rail-shaped inside layout
    // frames. The h-11 label row keeps its hairline collinear with the
    // docs-frame topbar rendered beside this example.
    <div className="flex h-full w-64 flex-col">
      <div className="flex h-11 items-center border-b border-border px-3">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          Variant
        </span>
      </div>
      <div className="border-b border-border px-2 py-2">
        <ToggleGroup<SidebarVariant>
          value={variant}
          onChange={(v) => v && setVariant(v)}
          label="Sidebar variant"
          variant="bracket"
          wrap
        >
          {VARIANTS.map(({ value, label }) => (
            <ToggleGroup.Item key={value} value={value} className="min-h-7 px-1">
              {label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </div>

      <Sidebar variant={variant} className="flex-1">
        <SidebarHeader>
          <span className="text-sm font-mono font-bold">Docs</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarSection>
            <SidebarSectionTitle>Getting Started</SidebarSectionTitle>
            <SidebarItem>Install</SidebarItem>
            <SidebarItem>Quickstart</SidebarItem>
            <SidebarItem>Theming</SidebarItem>
          </SidebarSection>
          <SidebarSection>
            <SidebarSectionTitle>Components</SidebarSectionTitle>
            <SidebarItem active>Sidebar</SidebarItem>
            <SidebarItem>Dialog</SidebarItem>
            <SidebarItem>
              <SidebarItemLabel>Stepper</SidebarItemLabel>
              <SidebarItemBadge>
                <span className="text-xs text-muted-foreground">new</span>
              </SidebarItemBadge>
            </SidebarItem>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
    </div>
  );
}
