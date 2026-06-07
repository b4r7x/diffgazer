import { HorizontalStepper } from "@/components/ui/horizontal-stepper";

export default function HorizontalStepperVariantAscii() {
  return (
    <HorizontalStepper
      steps={["init", "build", "test", "deploy", "verify"]}
      value="test"
      variant="ascii"
      aria-label="CI pipeline progress"
    >
      <HorizontalStepper.Step value="init">Init</HorizontalStepper.Step>
      <HorizontalStepper.Step value="build">Build</HorizontalStepper.Step>
      <HorizontalStepper.Step value="test">Test</HorizontalStepper.Step>
      <HorizontalStepper.Step value="deploy">Deploy</HorizontalStepper.Step>
      <HorizontalStepper.Step value="verify">Verify</HorizontalStepper.Step>
    </HorizontalStepper>
  );
}
