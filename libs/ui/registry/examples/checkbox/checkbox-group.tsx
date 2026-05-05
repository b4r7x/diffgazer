"use client";

import { useState } from "react"
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox"

export default function CheckboxGroupDemo() {
  const [value, setValue] = useState<string[]>(["typescript"])

  return (
    <CheckboxGroup
      value={value}
      onChange={setValue}
    >
      <CheckboxItem value="typescript" label="TypeScript" />
      <CheckboxItem value="react" label="React" />
      <CheckboxItem value="tailwind" label="Tailwind CSS" />
      <CheckboxItem value="vite" label="Vite" />
    </CheckboxGroup>
  )
}
