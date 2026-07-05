import type { ProgressStatus } from "@diffgazer/core/schemas/presentation";
import { Stepper } from "@diffgazer/ui/components/stepper";

export interface ProgressStepProps {
  label: string;
  status: ProgressStatus;
  stepId?: string;
}

const STEP_STATUS_LABELS: Record<ProgressStatus, string> = {
  completed: "DONE",
  active: "RUN",
  pending: "WAIT",
};

export function ProgressStep({ label, status, stepId }: ProgressStepProps) {
  return (
    <Stepper.Step stepId={stepId ?? label} status={status} className="py-1">
      <Stepper.Trigger disabled statusLabels={STEP_STATUS_LABELS}>
        {label}
      </Stepper.Trigger>
    </Stepper.Step>
  );
}
