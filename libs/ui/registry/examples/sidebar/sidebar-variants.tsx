"use client"

import { useState } from "react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
  SidebarItemLabel,
  SidebarItemBadge,
  type SidebarVariant,
} from "@/components/ui/sidebar"
import { ToggleGroup } from "@/components/ui/toggle-group"

const VARIANTS: { value: SidebarVariant; label: string }[] = [
  { value: "caret", label: "caret" },
  { value: "inverted", label: "inverted" },
  { value: "bar", label: "bar" },
  { value: "bracket", label: "bracket" },
  { value: "block", label: "block" },
  { value: "terminal", label: "terminal" },
]

export default function SidebarVariants() {
  const [variant, setVariant] = useState<SidebarVariant>("caret")

  return (
    <div className="flex h-full flex-col gap-4">
      <ToggleGroup<SidebarVariant>
        value={variant}
        onChange={(v) => v && setVariant(v)}
        label="Sidebar variant"
      >
        {VARIANTS.map(({ value, label }) => (
          <ToggleGroup.Item key={value} value={value}>
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>

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
  )
}
