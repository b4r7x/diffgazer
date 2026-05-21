import type { ReactNode } from "react";
import { Stepper, StepperSubstep, type SubstepStatus } from "@diffgazer/ui/components/stepper";
import type { ProgressStatus, ProgressSubstepData } from '@diffgazer/core/schemas/ui';

export type { ProgressStatus };

export interface ProgressStepProps {
  label: string;
  status: ProgressStatus;
  substeps?: ProgressSubstepData[];
  children?: ReactNode;
  stepId?: string;
  className?: string;
}

const STEP_STATUS_LABELS: Record<ProgressStatus, string> = {
  completed: "DONE",
  active: "RUN",
  pending: "WAIT",
};

const SUBSTEP_STATUS_LABELS: Record<SubstepStatus, string> = {
  pending: "",
  active: "analyzing...",
  completed: "done",
  error: "failed",
};

export function ProgressStep({
  label,
  status,
  substeps,
  children,
  stepId,
  className,
}: ProgressStepProps) {
  const hasContent = Boolean(children || (substeps && substeps.length > 0));

  return (
    <Stepper.Step stepId={stepId ?? label} status={status} className={className}>
      <Stepper.Trigger disabled={!hasContent} statusLabels={STEP_STATUS_LABELS}>
        {label}
      </Stepper.Trigger>
      {hasContent && (
        <Stepper.Content>
          {substeps && substeps.length > 0 && (
            <div className="space-y-1 mb-2">
              {substeps.map(({ id, progress: _progress, ...substep }) => (
                <StepperSubstep key={id} statusLabels={SUBSTEP_STATUS_LABELS} {...substep} />
              ))}
            </div>
          )}
          {children}
        </Stepper.Content>
      )}
    </Stepper.Step>
  );
}
