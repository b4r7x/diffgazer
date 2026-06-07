"use client";

import { useState } from "react";
import { Stepper, type StepperVariant } from "@/components/ui/stepper";
import { ToggleGroup } from "@/components/ui/toggle-group";

const VARIANTS: { value: StepperVariant; label: string }[] = [
  { value: "ascii", label: "ascii" },
  { value: "numbered", label: "numbered" },
  { value: "bullet", label: "bullet" },
  { value: "tag", label: "tag" },
  { value: "progress", label: "progress" },
];

export default function StepperVariants() {
  const [variant, setVariant] = useState<StepperVariant>("ascii");

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup<StepperVariant>
        value={variant}
        onChange={(v) => v && setVariant(v)}
        label="Stepper variant"
      >
        {VARIANTS.map(({ value, label }) => (
          <ToggleGroup.Item key={value} value={value}>
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>

      <Stepper variant={variant}>
        <Stepper.Step stepId="init" status="completed">
          <Stepper.Trigger>Init repository</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="install" status="completed">
          <Stepper.Trigger>Install dependencies</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="build" status="active">
          <Stepper.Trigger>Build production bundle</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="test" status="error">
          <Stepper.Trigger>Run tests</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="deploy" status="pending">
          <Stepper.Trigger>Deploy</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="notify" status="skipped">
          <Stepper.Trigger>Notify (optional)</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="rollback" status="disabled">
          <Stepper.Trigger>Rollback (locked)</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>
    </div>
  );
}
