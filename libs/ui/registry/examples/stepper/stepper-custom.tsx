import { Stepper } from "@/components/ui/stepper"

export default function StepperCustom() {
  return (
    <Stepper defaultExpandedIds={["lint", "test"]}>
      <Stepper.Step stepId="lint" status="completed">
        <Stepper.Trigger>Lint check</Stepper.Trigger>
        <Stepper.Content>
          <div className="space-y-1">
            <Stepper.Substep tag="ESL" label="ESLint" status="completed" detail="0 errors" />
            <Stepper.Substep tag="TSC" label="TypeScript" status="completed" detail="0 errors" />
          </div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="test" status="active">
        <Stepper.Trigger>Test suite</Stepper.Trigger>
        <Stepper.Content>
          <div className="space-y-1">
            <Stepper.Substep tag="UT" label="Unit tests" status="completed" />
            <Stepper.Substep tag="IT" label="Integration tests" status="error" detail="2 failures" />
            <Stepper.Substep tag="E2E" label="E2E tests" status="pending" />
          </div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="build" status="pending">
        <Stepper.Trigger>Build artifacts</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  )
}
