import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
}

export function WizardProgress({
  steps,
  currentStep,
}: WizardProgressProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <Box gap={2}>
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        let indicator: string;
        let color: string;

        if (isCompleted) {
          indicator = "[●]";
          color = tokens.success;
        } else if (isCurrent) {
          indicator = "[○]";
          color = tokens.accent;
        } else {
          indicator = "[ ]";
          color = tokens.muted;
        }

        return (
          <Text key={label} color={color} bold={isCurrent}>
            {indicator} {label}
          </Text>
        );
      })}
    </Box>
  );
}
