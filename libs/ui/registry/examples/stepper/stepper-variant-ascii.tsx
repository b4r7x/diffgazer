import { Stepper } from "@/components/ui/stepper";

export default function StepperVariantAscii() {
  return (
    <Stepper variant="ascii">
      <Stepper.Step stepId="init" status="completed">
        <Stepper.Trigger>Init repository</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="install" status="completed">
        <Stepper.Trigger>Install dependencies</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="build" status="active">
        <Stepper.Trigger>Build production bundle</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="test" status="pending">
        <Stepper.Trigger>Run tests</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="deploy" status="pending">
        <Stepper.Trigger>Deploy</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  );
}
