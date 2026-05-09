"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function SelectRadio() {
  const [value, setValue] = useState<string>("")
  return (
    <div className="w-64">
      <Select value={value} onChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Select environment..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="development" indicator="radio">development</SelectItem>
          <SelectItem value="staging" indicator="radio">staging</SelectItem>
          <SelectItem value="production" indicator="radio">production</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
