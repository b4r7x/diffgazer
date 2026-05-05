import { Stepper as StepperRoot, type StepperProps } from "./stepper";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import type { StepStatus, SubstepStatus } from "./stepper-context";
import { StepperTrigger, type StepperTriggerProps } from "./stepper-trigger";
import { StepperContent, type StepperContentProps } from "./stepper-content";
import { StepperSubstep, type StepperSubstepProps, type SubstepData } from "./stepper-substep";

const Stepper = Object.assign(StepperRoot, {
  Step: StepperStep,
  Trigger: StepperTrigger,
  Content: StepperContent,
  Substep: StepperSubstep,
});

export { Stepper, type StepperProps };
export { StepperStep, type StepperStepProps, type StepStatus };
export { StepperTrigger, type StepperTriggerProps };
export { StepperContent, type StepperContentProps };
export { StepperSubstep, type StepperSubstepProps, type SubstepData, type SubstepStatus };
