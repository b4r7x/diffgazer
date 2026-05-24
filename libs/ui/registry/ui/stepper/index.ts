"use client";

import "../shared/stepper.css";

import { Stepper as StepperRoot, type StepperProps } from "./stepper";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import type { StepStatus, SubstepStatus } from "./stepper-context";
import {
  StepperTrigger,
  type StepperTriggerProps,
  DEFAULT_STEP_STATUS_LABELS,
  getStepperIndicatorGlyph,
  STEP_STATUSES,
} from "./stepper-trigger";
import { StepperContent, type StepperContentProps } from "./stepper-content";
import {
  StepperSubstep,
  substepVariants,
  substepLabelVariants,
  type StepperSubstepProps,
  type SubstepData,
  SUBSTEP_STATUS_BADGE_VARIANTS,
} from "./stepper-substep";

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
