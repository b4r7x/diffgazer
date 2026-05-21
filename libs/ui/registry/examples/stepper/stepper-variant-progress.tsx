import { Stepper } from "@/components/ui/stepper"

export default function StepperVariantProgress() {
  return (
    <Stepper variant="progress">
      <Stepper.Step stepId="snapshot" status="completed">
        <Stepper.Trigger>Snapshot</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="diff" status="completed">
        <Stepper.Trigger>Diff</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="review" status="active">
        <Stepper.Trigger>Review</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="apply" status="pending">
        <Stepper.Trigger>Apply</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  )
}
