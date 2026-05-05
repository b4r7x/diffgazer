"use client";

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"

export default function CheckboxDefault() {
  const [checked, setChecked] = useState(false)
  return (
    <Checkbox
      checked={checked}
      onChange={setChecked}
      label="Accept terms and conditions"
    />
  )
}
