import { HorizontalStepper } from "@/components/ui/horizontal-stepper";

export default function HorizontalStepperVariantBreadcrumb() {
  return (
    <HorizontalStepper
      steps={["init", "build", "test", "deploy", "verify"]}
      value="test"
      variant="breadcrumb"
      aria-label="Pipeline path"
    >
      <HorizontalStepper.Step value="init">init</HorizontalStepper.Step>
      <HorizontalStepper.Step value="build">build</HorizontalStepper.Step>
      <HorizontalStepper.Step value="test">test</HorizontalStepper.Step>
      <HorizontalStepper.Step value="deploy">deploy</HorizontalStepper.Step>
      <HorizontalStepper.Step value="verify">verify</HorizontalStepper.Step>
    </HorizontalStepper>
  );
}
