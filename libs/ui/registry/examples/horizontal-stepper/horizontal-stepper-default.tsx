import { HorizontalStepper } from "@/components/ui/horizontal-stepper"

export default function HorizontalStepperDefault() {
  return (
    <HorizontalStepper steps={["select", "review", "confirm", "done"]} step="review">
      <HorizontalStepper.Step value="select">SELECT</HorizontalStepper.Step>
      <HorizontalStepper.Step value="review">REVIEW</HorizontalStepper.Step>
      <HorizontalStepper.Step value="confirm">CONFIRM</HorizontalStepper.Step>
      <HorizontalStepper.Step value="done">DONE</HorizontalStepper.Step>
    </HorizontalStepper>
  )
}
