"use client";

import { useState } from "react"
import { HorizontalStepper } from "@/components/ui/horizontal-stepper"
import { Button } from "@/components/ui/button"

const stepValues = ["init", "scan", "analyze", "report"] as const

export default function HorizontalStepperProgress() {
  const [currentIndex, setCurrentIndex] = useState(0)
  return (
    <div className="flex flex-col gap-4 items-start">
      <HorizontalStepper steps={[...stepValues]} step={stepValues[currentIndex]}>
        {stepValues.map((v) => (
          <HorizontalStepper.Step key={v} value={v}>{v.toUpperCase()}</HorizontalStepper.Step>
        ))}
      </HorizontalStepper>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCurrentIndex((i) => Math.min(stepValues.length - 1, i + 1))}
          disabled={currentIndex === stepValues.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
