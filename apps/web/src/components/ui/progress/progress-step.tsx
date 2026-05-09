import type { ReactNode } from "react";
import { Stepper, StepperSubstep } from "@diffgazer/ui/components/stepper";
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
      <Stepper.Trigger disabled={!hasContent}>{label}</Stepper.Trigger>
      {hasContent && (
        <Stepper.Content>
          {substeps && substeps.length > 0 && (
            <div className="space-y-1 mb-2">
              {substeps.map(({ id, progress: _progress, ...substep }) => (
                <StepperSubstep key={id} {...substep} />
              ))}
            </div>
          )}
          {children}
        </Stepper.Content>
      )}
    </Stepper.Step>
  );
}
