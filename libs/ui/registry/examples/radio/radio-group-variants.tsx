"use client";

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio"

export default function RadioGroupVariants() {
  const [size, setSize] = useState("md")
  const [plan, setPlan] = useState("pro")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Horizontal Layout</div>
        <RadioGroup
          value={size}
          onChange={setSize}
          orientation="horizontal"
          label="Size"
        >
          <RadioGroupItem value="sm" label="Small" />
          <RadioGroupItem value="md" label="Medium" />
          <RadioGroupItem value="lg" label="Large" />
        </RadioGroup>
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase font-bold mb-2">With Descriptions</div>
        <RadioGroup
          value={plan}
          onChange={setPlan}
          label="Plan"
        >
          <RadioGroupItem value="free" label="Free" description="Basic features, limited usage" />
          <RadioGroupItem value="pro" label="Pro" description="All features, priority support" />
          <RadioGroupItem value="enterprise" label="Enterprise" description="Custom solutions" disabled />
        </RadioGroup>
      </div>
    </div>
  )
}
