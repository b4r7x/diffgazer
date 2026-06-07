import { Stepper } from "@/components/ui/stepper";

export default function StepperVariantTag() {
  return (
    <Stepper variant="tag">
      <Stepper.Step stepId="lint" status="completed">
        <Stepper.Trigger>Lint</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="typecheck" status="completed">
        <Stepper.Trigger>Typecheck</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="unit" status="active">
        <Stepper.Trigger>Unit tests</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="integration" status="error">
        <Stepper.Trigger>Integration tests</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="deploy" status="pending">
        <Stepper.Trigger>Deploy preview</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  );
}
