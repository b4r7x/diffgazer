import { getOnboardingProgressLabel } from "@diffgazer/core/onboarding";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../../theme/provider";
import { WIZARD_PROGRESS_MARKERS } from "../lib/wizard-progress";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
  compact?: boolean;
}

export function WizardProgress({
  steps,
  currentStep,
  compact = false,
}: WizardProgressProps): ReactElement {
  const { tokens } = useTheme();

  if (compact) {
    return (
      <Text color={tokens.accent} bold>
        {WIZARD_PROGRESS_MARKERS.current} {getOnboardingProgressLabel(currentStep)}
      </Text>
    );
  }

  return (
    <Box gap={2}>
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        let indicator: string;
        let color: string;

        if (isCompleted) {
          indicator = WIZARD_PROGRESS_MARKERS.completed;
          color = tokens.success;
        } else if (isCurrent) {
          indicator = WIZARD_PROGRESS_MARKERS.current;
          color = tokens.accent;
        } else {
          indicator = WIZARD_PROGRESS_MARKERS.upcoming;
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
