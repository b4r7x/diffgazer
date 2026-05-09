"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectTags,
} from "@/components/ui/select"

export default function SelectTagsExample() {
  const [value, setValue] = useState<string[]>(["typescript", "rust"])

  return (
    <Select multiple width="lg" value={value} onChange={setValue}>
      <SelectTrigger>
        <SelectTags placeholder="Select languages..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="typescript">TypeScript</SelectItem>
        <SelectItem value="rust">Rust</SelectItem>
        <SelectItem value="go">Go</SelectItem>
        <SelectItem value="python">Python</SelectItem>
        <SelectItem value="zig">Zig</SelectItem>
      </SelectContent>
    </Select>
  )
}
