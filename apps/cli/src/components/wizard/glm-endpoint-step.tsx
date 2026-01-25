import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { GLMEndpoint } from "@repo/schemas/config";
import { Badge, SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";

interface GLMEndpointStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  initialEndpoint?: GLMEndpoint;
  onSelect: (endpoint: GLMEndpoint) => void;
  onBack?: () => void;
  isActive?: boolean;
}

const ENDPOINT_OPTIONS: SelectOption<GLMEndpoint>[] = [
  {
    id: "coding",
    label: "Coding Endpoint",
    description: "Optimized for code review and programming tasks",
    badge: <Badge text="Recommended" variant="success" />,
  },
  {
    id: "standard",
    label: "Standard Endpoint",
    description: "General-purpose endpoint for all tasks",
  },
];

export function GLMEndpointStep({
  mode,
  currentStep,
  totalSteps,
  initialEndpoint = "coding",
  onSelect,
  onBack,
  isActive = true,
}: GLMEndpointStepProps): ReactElement {
  const initialIndex = ENDPOINT_OPTIONS.findIndex((e) => e.id === initialEndpoint);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex));

  const handleSubmit = (option: SelectOption<GLMEndpoint>) => {
    onSelect(option.id);
  };

  useInput(
    (input) => {
      if (!isActive) return;

      if (input === "b" && onBack) {
        onBack();
      }
    },
    { isActive }
  );

  const footerText =
    mode === "onboarding"
      ? "Arrow keys to select, Enter to continue, [b] Back"
      : onBack
        ? "Arrow keys to select, Enter to configure, [b] Back"
        : "Arrow keys to select, Enter to configure";

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="GLM Endpoint"
      footer={footerText}
    >
      <Text dimColor>Select the GLM API endpoint:</Text>
      <Box marginTop={1} marginBottom={1}>
        <Text color="yellow">
          Z.ai offers a specialized coding endpoint that is optimized for code analysis.
        </Text>
      </Box>

      <SelectList
        options={ENDPOINT_OPTIONS}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onSubmit={handleSubmit}
        isActive={isActive}
      />
    </WizardFrame>
  );
}
