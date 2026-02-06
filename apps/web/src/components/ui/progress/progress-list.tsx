'use client';

import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { ProgressStep } from './progress-step';
import type { ProgressStepData as BaseProgressStepData } from '@stargazer/schemas/ui';

// Extend with ReactNode content for runtime use
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
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step) => (
        <ProgressStep
          key={step.id}
          label={step.label}
          status={step.status}
          substeps={step.substeps}
          isExpanded={expandedIds.includes(step.id)}
          onToggle={onToggle ? () => onToggle(step.id) : undefined}
        >
          {step.content}
        </ProgressStep>
      ))}
    </div>
  );
}

export { type ProgressStatus } from './progress-step';
