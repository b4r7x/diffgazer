"use client";

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio"

export default function RadioGroupDefault() {
  const [value, setValue] = useState("react")

  return (
    <RadioGroup
      value={value}
      onChange={setValue}
      label="Framework"
    >
      <RadioGroupItem value="react" label="React" />
      <RadioGroupItem value="vue" label="Vue" />
      <RadioGroupItem value="svelte" label="Svelte" />
      <RadioGroupItem value="angular" label="Angular" />
    </RadioGroup>
  )
}
