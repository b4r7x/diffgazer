import { HorizontalStepper } from "@/components/ui/horizontal-stepper";

const STEPS = ["clone", "install", "build", "publish"];

function Pipeline({ value }: { value: string }) {
  return (
    <HorizontalStepper steps={STEPS} value={value} variant="ascii" aria-label="Release pipeline">
      <HorizontalStepper.Step value="clone">Clone</HorizontalStepper.Step>
      <HorizontalStepper.Step value="install">Install</HorizontalStepper.Step>
      <HorizontalStepper.Step value="build">Build</HorizontalStepper.Step>
      <HorizontalStepper.Step value="publish">Publish</HorizontalStepper.Step>
    </HorizontalStepper>
  );
}

export default function HorizontalStepperVariantAscii() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <p className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          First step active — nothing completed yet
        </p>
        <Pipeline value="clone" />
      </div>
      <div className="space-y-2">
        <p className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          Mid-run — completed connectors fill behind the active step
        </p>
        <Pipeline value="build" />
      </div>
      <div className="space-y-2">
        <p className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          Last step active — every earlier step completed
        </p>
        <Pipeline value="publish" />
      </div>
    </div>
  );
}
