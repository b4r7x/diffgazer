"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function SelectMultiple() {
  const [value, setValue] = useState<string[]>(["typescript"])
  return (
    <div className="w-64">
      <Select multiple variant="card" value={value} onChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Select languages..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="typescript">TypeScript</SelectItem>
          <SelectItem value="rust">Rust</SelectItem>
          <SelectItem value="go">Go</SelectItem>
          <SelectItem value="python">Python</SelectItem>
          <SelectItem value="zig">Zig</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
