"use client";

import "../shared/stepper.css";

import { HorizontalStepperRoot, type HorizontalStepperProps } from "./horizontal-stepper";
import { HorizontalStepperStep, type HorizontalStepperStepProps } from "./horizontal-stepper-step";

const HorizontalStepper = Object.assign(HorizontalStepperRoot, {
  Step: HorizontalStepperStep,
});

export { HorizontalStepper, type HorizontalStepperProps };
export { HorizontalStepperStep, type HorizontalStepperStepProps };
export { useStepInfo, type StepStatus } from "./horizontal-stepper-context";
export type { HorizontalStepperVariant } from "@/lib/stepper-variants";
