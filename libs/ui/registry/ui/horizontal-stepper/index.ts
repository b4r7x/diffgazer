"use client";

import "../shared/stepper.css";

import { type HorizontalStepperProps, HorizontalStepperRoot } from "./horizontal-stepper";
import { HorizontalStepperStep, type HorizontalStepperStepProps } from "./horizontal-stepper-step";

const HorizontalStepper = Object.assign(HorizontalStepperRoot, {
  Step: HorizontalStepperStep,
});

export { HorizontalStepper, type HorizontalStepperProps };
export { HorizontalStepperStep, type HorizontalStepperStepProps };
export type { HorizontalStepperVariant } from "@/lib/stepper-variants";
export { type StepStatus, useStepInfo } from "./horizontal-stepper-context";
