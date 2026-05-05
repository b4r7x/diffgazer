import { Stepper } from "@/components/ui/stepper"

export default function StepperDefault() {
  return (
    <Stepper>
      <Stepper.Step stepId="select" status="completed">
        <Stepper.Trigger>Select files for review</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="analyze" status="active">
        <Stepper.Trigger>Analyze code changes</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="report" status="pending">
        <Stepper.Trigger>Generate review report</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  )
}
