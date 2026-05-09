"use client";

import { useState } from "react"
import { ToggleGroup } from "@/components/ui/toggle-group"

export default function ToggleGroupDefault() {
  const [value, setValue] = useState<string | null>("all")

  return (
    <ToggleGroup value={value} onChange={setValue}>
      <ToggleGroup.Item value="all">All</ToggleGroup.Item>
      <ToggleGroup.Item value="added">Added</ToggleGroup.Item>
      <ToggleGroup.Item value="modified">Modified</ToggleGroup.Item>
      <ToggleGroup.Item value="deleted">Deleted</ToggleGroup.Item>
    </ToggleGroup>
  )
}
