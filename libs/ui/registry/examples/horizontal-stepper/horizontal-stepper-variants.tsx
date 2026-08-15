"use client";

import { useState } from "react";
import {
  HorizontalStepper,
  type HorizontalStepperVariant,
} from "@/components/ui/horizontal-stepper";
import { createToggleGroup } from "@/components/ui/toggle-group";

const VARIANTS = [
  { value: "ascii", label: "ascii" },
  { value: "numbered", label: "numbered" },
  { value: "breadcrumb", label: "breadcrumb" },
] as const satisfies readonly { value: HorizontalStepperVariant; label: string }[];

const HorizontalStepperVariantGroup = createToggleGroup([
  "ascii",
  "numbered",
  "breadcrumb",
] as const);

export default function HorizontalStepperVariants() {
  const [variant, setVariant] = useState<HorizontalStepperVariant>("ascii");

  return (
    <div className="flex flex-col gap-4">
      <HorizontalStepperVariantGroup
        value={variant}
        onChange={(v) => v && setVariant(v)}
        label="Horizontal stepper variant"
      >
        {VARIANTS.map(({ value, label }) => (
          <HorizontalStepperVariantGroup.Item key={value} value={value}>
            {label}
          </HorizontalStepperVariantGroup.Item>
        ))}
      </HorizontalStepperVariantGroup>

      <HorizontalStepper value="test" variant={variant}>
        <HorizontalStepper.Step value="init">Init</HorizontalStepper.Step>
        <HorizontalStepper.Step value="build">Build</HorizontalStepper.Step>
        <HorizontalStepper.Step value="test">Test</HorizontalStepper.Step>
        <HorizontalStepper.Step value="deploy">Deploy</HorizontalStepper.Step>
        <HorizontalStepper.Step value="verify">Verify</HorizontalStepper.Step>
      </HorizontalStepper>
    </div>
  );
}
