import type { ReactElement, ReactNode } from "react";
import { Box } from "ink";
import { ProgressStep, type ProgressStatus } from "./progress-step.js";

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
}

export function ProgressList({
  steps,
  expandedIds = [],
  onToggle,
}: ProgressListProps): ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
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
    </Box>
  );
}

export { type ProgressStatus } from "./progress-step.js";
