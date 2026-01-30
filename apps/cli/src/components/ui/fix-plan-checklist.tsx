import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import type { FixPlanStep } from "@repo/schemas";

export interface FixPlanChecklistProps {
  steps: FixPlanStep[];
  completedSteps: Set<number>;
  focusedStep?: number;
}

export function FixPlanChecklist({
  steps,
  completedSteps,
  focusedStep,
}: FixPlanChecklistProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" gap={0}>
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.step);
        const isFocused = focusedStep === step.step;

        return (
          <Box key={step.step}>
            <Text
              color={isComplete ? colors.ui.success : colors.ui.text}
              inverse={isFocused}
            >
              [{isComplete ? "x" : " "}]
            </Text>
            <Text> </Text>
            <Text
              color={isComplete ? colors.ui.textMuted : colors.ui.text}
              strikethrough={isComplete}
              inverse={isFocused}
            >
              {step.action}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
