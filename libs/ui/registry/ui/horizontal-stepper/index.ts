import { HorizontalStepperRoot, type HorizontalStepperProps } from "./horizontal-stepper";
import { HorizontalStepperStep, type HorizontalStepperStepProps } from "./horizontal-stepper-step";

const HorizontalStepper = Object.assign(HorizontalStepperRoot, {
  Step: HorizontalStepperStep,
});

export { HorizontalStepper, type HorizontalStepperProps };
export { HorizontalStepperStep, type HorizontalStepperStepProps };
export { stepVariants } from "./horizontal-stepper-step";
export { useStepInfo, type StepStatus } from "./horizontal-stepper-context";
