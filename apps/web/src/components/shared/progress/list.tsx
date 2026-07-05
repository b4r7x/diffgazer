import type { ProgressStepData } from "@diffgazer/core/schemas/presentation";
import { Stepper } from "@diffgazer/ui/components/stepper";
import { ProgressStep } from "./step";

export interface ProgressListProps {
  steps: ProgressStepData[];
  className?: string;
}

export function ProgressList({ steps, className }: ProgressListProps) {
  return (
    <Stepper variant="tag" className={className}>
      {steps.map((step) => (
        <ProgressStep key={step.id} stepId={step.id} label={step.label} status={step.status} />
      ))}
    </Stepper>
  );
}
