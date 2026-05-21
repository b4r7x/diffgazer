import { Stepper } from "@/components/ui/stepper"

export default function StepperVariantBullet() {
  return (
    <Stepper variant="bullet">
      <Stepper.Step stepId="open" status="completed">
        <Stepper.Trigger>Open PR</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="ci" status="completed">
        <Stepper.Trigger>Run CI</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="review" status="active">
        <Stepper.Trigger>Request review</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="checks" status="error">
        <Stepper.Trigger>CI checks</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="merge" status="pending">
        <Stepper.Trigger>Merge</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  )
}
