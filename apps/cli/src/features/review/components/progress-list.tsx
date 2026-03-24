import { Box } from "ink";
import { ProgressStep } from "./progress-step.js";
import type { ProgressStepProps } from "./progress-step.js";

export interface ProgressListProps {
  steps: Array<{
    name: string;
    status: ProgressStepProps["status"];
    substeps?: string[];
    duration?: number;
  }>;
}

export function ProgressList({ steps }: ProgressListProps) {
  return (
    <Box flexDirection="column">
      {steps.map((step) => (
        <ProgressStep
          key={step.name}
          name={step.name}
          status={step.status}
          substeps={step.substeps}
          duration={step.duration}
        />
      ))}
    </Box>
  );
}
