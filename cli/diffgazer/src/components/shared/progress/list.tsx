import type { ProgressStepData } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import { ProgressStep } from "./step";

export interface ProgressListProps {
  steps: ProgressStepData[];
}

export function ProgressList({ steps }: ProgressListProps) {
  return (
    <Box flexDirection="column">
      {steps.map((step) => (
        <ProgressStep
          key={step.id}
          name={step.label}
          status={step.status}
          substeps={step.substeps}
        />
      ))}
    </Box>
  );
}
