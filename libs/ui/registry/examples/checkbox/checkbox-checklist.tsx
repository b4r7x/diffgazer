"use client";

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"

export default function CheckboxChecklist() {
  const [value, setValue] = useState(["setup", "tailwind"])

  return (
    <Checkbox.Group value={value} onChange={setValue} strikethrough>
      <Checkbox.Item value="setup" label="Set up project structure" />
      <Checkbox.Item value="typescript" label="Configure TypeScript" />
      <Checkbox.Item value="tailwind" label="Add Tailwind CSS" />
      <Checkbox.Item value="component" label="Create first component" />
      <Checkbox.Item value="tests" label="Write tests" />
    </Checkbox.Group>
  )
}
