'use client';

import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ProgressStep, type ProgressStatus } from './progress-step';

export interface ProgressStepData {
  id: string;
  label: string;
  status: ProgressStatus;
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
