"use client";

import { useState } from "react"
import { Switch } from "@/components/ui/switch"

export default function SwitchDefault() {
  const [checked, setChecked] = useState(false)
  return (
    <Switch
      checked={checked}
      onChange={setChecked}
      aria-label="Enable notifications"
    />
  )
}
