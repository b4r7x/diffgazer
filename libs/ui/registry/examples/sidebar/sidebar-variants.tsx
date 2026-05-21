"use client";

import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarSectionTitle,
  type SidebarVariant,
} from "@/components/ui/sidebar"
import { ToggleGroup } from "@/components/ui/toggle-group"

const VARIANTS: readonly SidebarVariant[] = ["caret", "inverted", "bar", "bracket", "block"]

export default function SidebarVariants() {
  const [variant, setVariant] = useState<SidebarVariant>("caret")
  const [active, setActive] = useState("quickstart")

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup<SidebarVariant>
        label="Sidebar variant"
        value={variant}
        onChange={(value) => value && setVariant(value)}
      >
        {VARIANTS.map((v) => (
          <ToggleGroup.Item key={v} value={v}>
            {v}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>
      <Sidebar variant={variant} className="w-64 h-80 border border-border bg-background">
        <SidebarHeader>
          <span className="text-xs font-mono text-muted-foreground">~/ui/docs</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarSection>
            <SidebarSectionTitle>getting-started</SidebarSectionTitle>
            <SidebarItem active={active === "install"} onClick={() => setActive("install")}>
              install
            </SidebarItem>
            <SidebarItem active={active === "quickstart"} onClick={() => setActive("quickstart")}>
              quickstart
            </SidebarItem>
            <SidebarItem active={active === "theming"} onClick={() => setActive("theming")}>
              theming
            </SidebarItem>
          </SidebarSection>
          <SidebarSection>
            <SidebarSectionTitle>primitives</SidebarSectionTitle>
            <SidebarItem active={active === "dialog"} onClick={() => setActive("dialog")}>
              dialog
            </SidebarItem>
            <SidebarItem active={active === "sidebar"} onClick={() => setActive("sidebar")}>
              sidebar
            </SidebarItem>
            <SidebarItem active={active === "stepper"} onClick={() => setActive("stepper")}>
              stepper
            </SidebarItem>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
    </div>
  )
}
