"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

const items = ["bug", "feature", "docs", "refactor", "test"]

function SelectWithDisplay({
  label,
  display,
  truncateAfter,
}: {
  label: string
  display: "count" | "list" | "truncate"
  truncateAfter?: number
}) {
  const [value, setValue] = useState<string[]>(["bug", "feature", "docs"])
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <Select multiple value={value} onChange={setValue}>
        <SelectTrigger>
          <SelectValue
            placeholder="Select..."
            display={display}
            truncateAfter={truncateAfter}
          />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item} value={item} indicator="none">
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function SelectDisplayModes() {
  return (
    <div className="flex flex-col gap-4 w-64">
      <SelectWithDisplay label='display="count"' display="count" />
      <SelectWithDisplay label='display="list"' display="list" />
      <SelectWithDisplay
        label='display="truncate" truncateAfter={2}'
        display="truncate"
        truncateAfter={2}
      />
    </div>
  )
}
