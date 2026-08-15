import type { RunnableSetupPlan } from "@diffgazer/core/onboarding";
import { getOnboardingProgressLabel, STEP_LABELS } from "@diffgazer/core/onboarding";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../../theme/provider";
import { WIZARD_PROGRESS_MARKERS } from "../lib/wizard-progress";

interface WizardProgressProps {
  plan: RunnableSetupPlan;
  currentStep: number;
  compact?: boolean;
}

export function WizardProgress({
  plan,
  currentStep,
  compact = false,
}: WizardProgressProps): ReactElement {
  const { tokens } = useTheme();
  const labels = plan.steps.map((step) => STEP_LABELS[step.id]);

  if (compact) {
    return (
      <Text color={tokens.accent} bold>
        {WIZARD_PROGRESS_MARKERS.current} {getOnboardingProgressLabel(plan, currentStep)}
      </Text>
    );
  }

  return (
    <Box gap={2}>
      {labels.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const stepId = plan.steps[index]?.id ?? label;

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
          <Text key={stepId} color={color} bold={isCurrent}>
            {indicator} {label}
          </Text>
        );
      })}
    </Box>
  );
}
