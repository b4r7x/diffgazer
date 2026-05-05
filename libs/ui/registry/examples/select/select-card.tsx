"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

export default function SelectCard() {
  const [value, setValue] = useState<string[]>(["svelte"])
  return (
    <div className="w-72">
      <Select multiple variant="card" value={value} onChange={setValue}>
        <SelectTrigger>
          <span>Choose Framework</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="react">React</SelectItem>
          <SelectItem value="vue">Vue</SelectItem>
          <SelectItem value="svelte">Svelte</SelectItem>
          <SelectItem value="angular">Angular</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
