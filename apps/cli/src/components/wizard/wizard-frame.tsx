import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";

type WizardMode = "onboarding" | "settings";

interface WizardFrameProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function WizardFrame({
  mode,
  currentStep,
  totalSteps,
  stepTitle,
  children,
  footer,
}: WizardFrameProps): ReactElement {
  const headerText = mode === "onboarding" ? "Setup" : "Settings";

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {headerText}
        </Text>
        <Text dimColor>
          {" "}
          - Step {currentStep}/{totalSteps}
        </Text>
      </Box>

      <Text bold>{stepTitle}</Text>
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>

      {footer && (
        <Box marginTop={1}>
          <Text dimColor>{footer}</Text>
        </Box>
      )}
    </Box>
  );
}
