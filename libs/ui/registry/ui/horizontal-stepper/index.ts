"use client";

import { type HorizontalStepperProps, HorizontalStepperRoot } from "./horizontal-stepper";
import { HorizontalStepperStep, type HorizontalStepperStepProps } from "./horizontal-stepper-step";

const HorizontalStepper = Object.assign(HorizontalStepperRoot, {
  Step: HorizontalStepperStep,
});

export { HorizontalStepper, type HorizontalStepperProps };
export { HorizontalStepperStep, type HorizontalStepperStepProps };
export type { HorizontalStepStatus } from "./horizontal-stepper-context";
export type { HorizontalStepperVariant } from "./horizontal-stepper-variants";
