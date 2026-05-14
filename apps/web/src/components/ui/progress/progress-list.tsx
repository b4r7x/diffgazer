import { type ReactNode } from 'react';
import { cn } from '@diffgazer/ui/lib/utils';
import { Stepper } from "@diffgazer/ui/components/stepper";
import { ProgressStep } from './progress-step';
import type { ProgressStepData as BaseProgressStepData } from '@diffgazer/core/schemas/ui';

export interface ProgressStepData extends BaseProgressStepData {
  content?: ReactNode;
}

export interface ProgressListProps {
  steps: ProgressStepData[];
  expandedIds?: string[];
  onToggle?: (id: string) => void;
  className?: string;
}

export function ProgressList({
  steps,
  expandedIds = [],
  onToggle,
  className,
}: ProgressListProps) {
  const handleExpandedChange = (nextExpandedIds: string[]) => {
    const toggled = steps.find((step) => expandedIds.includes(step.id) !== nextExpandedIds.includes(step.id));
    if (toggled) onToggle?.(toggled.id);
  };

  return (
    <Stepper
      expandedIds={expandedIds}
      onExpandedChange={handleExpandedChange}
      className={cn('space-y-4', className)}
    >
      {steps.map((step) => (
        <ProgressStep
          key={step.id}
          stepId={step.id}
          label={step.label}
          status={step.status}
          substeps={step.substeps}
        >
          {step.content}
        </ProgressStep>
      ))}
    </Stepper>
  );
}
