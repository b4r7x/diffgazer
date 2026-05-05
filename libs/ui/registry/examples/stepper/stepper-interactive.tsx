"use client";

import { useState } from "react"
import { Stepper } from "@/components/ui/stepper"

export default function StepperInteractive() {
  const [expandedIds, setExpandedIds] = useState<string[]>(["step-2"])

  return (
    <Stepper expandedIds={expandedIds} onExpandedChange={setExpandedIds}>
      <Stepper.Step stepId="step-1" status="completed">
        <Stepper.Trigger>Environment setup</Stepper.Trigger>
        <Stepper.Content>
          <div className="text-sm text-muted-foreground">Node.js 22, pnpm 9.15</div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="step-2" status="completed">
        <Stepper.Trigger>Install dependencies</Stepper.Trigger>
        <Stepper.Content>
          <div className="text-sm text-muted-foreground">Installed 847 packages in 12.3s</div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="step-3" status="active">
        <Stepper.Trigger>Run tests</Stepper.Trigger>
        <Stepper.Content>
          <div className="text-sm text-foreground">Running 45 test suites...</div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="step-4" status="pending">
        <Stepper.Trigger>Deploy</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  )
}
