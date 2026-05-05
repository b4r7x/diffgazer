import { Stepper } from "@/components/ui/stepper"

export default function StepperSubsteps() {
  return (
    <Stepper defaultExpandedIds={["parse", "analyze"]}>
      <Stepper.Step stepId="parse" status="completed">
        <Stepper.Trigger>Parse diff</Stepper.Trigger>
        <Stepper.Content>
          <div className="space-y-1">
            <Stepper.Substep tag="GIT" label="Read git diff" status="completed" />
            <Stepper.Substep tag="AST" label="Parse file changes" status="completed" />
          </div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="analyze" status="active">
        <Stepper.Trigger>AI analysis</Stepper.Trigger>
        <Stepper.Content>
          <div className="space-y-1">
            <Stepper.Substep tag="SEC" label="Security review" status="completed" />
            <Stepper.Substep tag="BUG" label="Bug detection" status="active" />
            <Stepper.Substep tag="STY" label="Style suggestions" status="pending" />
          </div>
        </Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="report" status="pending">
        <Stepper.Trigger>Build report</Stepper.Trigger>
        <Stepper.Content>
          <div className="space-y-1">
            <Stepper.Substep tag="FMT" label="Format findings" status="pending" />
            <Stepper.Substep tag="OUT" label="Write output" status="pending" />
          </div>
        </Stepper.Content>
      </Stepper.Step>
    </Stepper>
  )
}
