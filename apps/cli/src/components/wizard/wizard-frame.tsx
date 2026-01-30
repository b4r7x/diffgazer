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
  /** Width of the frame. Use percentage string ("60%") or number for chars */
  width?: number | string;
  /** Whether to center the frame horizontally */
  centered?: boolean;
}

export function WizardFrame({
  mode,
  currentStep,
  totalSteps,
  stepTitle,
  children,
  footer,
  width,
  centered = false,
}: WizardFrameProps): ReactElement {
  const headerText = mode === "onboarding" ? "Setup" : "Settings";

  const content = (
    <Box flexDirection="column" paddingX={1} width={width}>
      <Box>
        <Text bold color="cyan">
          {headerText}
        </Text>
        <Text dimColor>
          {" "}
          - Step {currentStep}/{totalSteps}
        </Text>
      </Box>

      <Text bold>{stepTitle}</Text>
      <Box flexDirection="column">
        {children}
      </Box>

      {footer && (
        <Box>
          <Text dimColor>{footer}</Text>
        </Box>
      )}
    </Box>
  );

  if (centered) {
    return (
      <Box justifyContent="center" width="100%">
        {content}
      </Box>
    );
  }

  return content;
}
