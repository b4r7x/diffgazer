import { Stepper } from "@/components/ui/stepper";

export default function StepperStateMatrix() {
  return (
    <Stepper variant="ascii">
      <Stepper.Step stepId="completed" status="completed">
        <Stepper.Trigger>Completed — step finished successfully</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="active" status="active">
        <Stepper.Trigger>Active — currently focused step</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="pending" status="pending">
        <Stepper.Trigger>Pending — not yet reached</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="error" status="error">
        <Stepper.Trigger>Error — validation failed</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="skipped" status="skipped">
        <Stepper.Trigger>Skipped — optional step bypassed</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="disabled" status="disabled">
        <Stepper.Trigger>Disabled — policy gate (not reachable)</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  );
}
