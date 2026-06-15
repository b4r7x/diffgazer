import { Stepper } from "@/components/ui/stepper";

// Tone is derived from `status` by the built-in variant dictionary:
//   completed → success · active → foreground · error → error
//   pending → muted · skipped → muted (line-through) · disabled → muted (dim)
// No per-step color wiring required — the indicator glyph still carries
// meaning (WCAG 1.4.1), color only reinforces it.
export default function StepperAutoTone() {
  return (
    <Stepper variant="bullet">
      <Stepper.Step stepId="tag" status="completed">
        <Stepper.Trigger>Tag release</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="publish" status="completed">
        <Stepper.Trigger>Publish npm</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="docs" status="active">
        <Stepper.Trigger>Update docs</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="cache" status="error">
        <Stepper.Trigger>Cache warm-up</Stepper.Trigger>
      </Stepper.Step>
      <Stepper.Step stepId="notify" status="pending">
        <Stepper.Trigger>Notify Slack</Stepper.Trigger>
      </Stepper.Step>
    </Stepper>
  );
}
