"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function SelectMultiselectSimple() {
  const [value, setValue] = useState<string[]>([])
  return (
    <div className="w-64">
      <Select multiple value={value} onChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Select tags..." display="list" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bug" indicator="none">bug</SelectItem>
          <SelectItem value="feature" indicator="none">feature</SelectItem>
          <SelectItem value="docs" indicator="none">docs</SelectItem>
          <SelectItem value="refactor" indicator="none">refactor</SelectItem>
          <SelectItem value="test" indicator="none">test</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
