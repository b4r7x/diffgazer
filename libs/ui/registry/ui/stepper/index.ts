"use client";

import { type StepperProps, Stepper as StepperRoot } from "./stepper";
import { StepperContent, type StepperContentProps } from "./stepper-content";
import type { StepStatus, SubstepStatus } from "./stepper-context";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import {
  StepperSubstep,
  type StepperSubstepProps,
  SUBSTEP_STATUS_BADGE_VARIANTS,
  type SubstepData,
  substepLabelVariants,
  substepVariants,
} from "./stepper-substep";
import {
  DEFAULT_STEP_STATUS_LABELS,
  getStepperIndicatorGlyph,
  STEP_STATUSES,
  StepperTrigger,
  type StepperTriggerProps,
} from "./stepper-trigger";

/** Root provider (manages expansion + variant) */
const Stepper = Object.assign(StepperRoot, {
  Step: StepperStep,
  Trigger: StepperTrigger,
  Content: StepperContent,
  Substep: StepperSubstep,
});

export { Stepper, type StepperProps };
export { StepperStep, type StepperStepProps, type StepStatus };
export {
  StepperTrigger,
  type StepperTriggerProps,
  DEFAULT_STEP_STATUS_LABELS,
  getStepperIndicatorGlyph,
  STEP_STATUSES,
};
export { StepperContent, type StepperContentProps };
export {
  StepperSubstep,
  substepVariants,
  substepLabelVariants,
  type StepperSubstepProps,
  type SubstepData,
  type SubstepStatus,
  SUBSTEP_STATUS_BADGE_VARIANTS,
};
export type { StepperVariant } from "@/lib/stepper-variants";
