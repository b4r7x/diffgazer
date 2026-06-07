import { Stepper } from "@/components/ui/stepper";

export default function StepperVariantNumbered() {
  return (
    <Stepper variant="numbered">
      <Stepper.Step stepId="account" status="completed">
        <Stepper.Trigger>Create account</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="ssh" status="completed">
        <Stepper.Trigger>Add SSH key</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="repo" status="active">
        <Stepper.Trigger>Connect repository</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="team" status="pending">
        <Stepper.Trigger>Invite team</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  );
}
