"use client";

import { useState } from "react"
import { ToggleGroup } from "@/components/ui/toggle-group"

export default function ToggleGroupCounts() {
  const [filter, setFilter] = useState<string | null>("error")
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup value={filter} onChange={setFilter} allowDeselect size="sm">
        <ToggleGroup.Item value="error" count={3}>Error</ToggleGroup.Item>
        <ToggleGroup.Item value="warning" count={12}>Warning</ToggleGroup.Item>
        <ToggleGroup.Item value="info" count={27}>Info</ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup value={filter} onChange={setFilter} allowDeselect size="md">
        <ToggleGroup.Item value="error" count={3}>Error</ToggleGroup.Item>
        <ToggleGroup.Item value="warning" count={12}>Warning</ToggleGroup.Item>
      </ToggleGroup>
    </div>
  )
}
