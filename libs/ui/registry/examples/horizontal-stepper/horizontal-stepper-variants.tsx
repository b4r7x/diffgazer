"use client";

import { useState } from "react";
import {
  HorizontalStepper,
  type HorizontalStepperVariant,
} from "@/components/ui/horizontal-stepper";
import { ToggleGroup } from "@/components/ui/toggle-group";

const VARIANTS: { value: HorizontalStepperVariant; label: string }[] = [
  { value: "ascii", label: "ascii" },
  { value: "numbered", label: "numbered" },
  { value: "breadcrumb", label: "breadcrumb" },
];

export default function HorizontalStepperVariants() {
  const [variant, setVariant] = useState<HorizontalStepperVariant>("ascii");

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup<HorizontalStepperVariant>
        value={variant}
        onChange={(v) => v && setVariant(v)}
        label="Horizontal stepper variant"
      >
        {VARIANTS.map(({ value, label }) => (
          <ToggleGroup.Item key={value} value={value}>
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>

      <HorizontalStepper
        steps={["init", "build", "test", "deploy", "verify"]}
        value="test"
        variant={variant}
      >
        <HorizontalStepper.Step value="init">Init</HorizontalStepper.Step>
        <HorizontalStepper.Step value="build">Build</HorizontalStepper.Step>
        <HorizontalStepper.Step value="test">Test</HorizontalStepper.Step>
        <HorizontalStepper.Step value="deploy">Deploy</HorizontalStepper.Step>
        <HorizontalStepper.Step value="verify">Verify</HorizontalStepper.Step>
      </HorizontalStepper>
    </div>
  );
}
