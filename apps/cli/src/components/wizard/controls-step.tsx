import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { ControlsMode } from "@repo/schemas/settings";
import { CONTROLS_MODES } from "@repo/schemas/settings";
import { SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";

interface ControlsStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  initialControlsMode: ControlsMode;
  onSubmit: (controlsMode: ControlsMode) => void;
  onBack?: () => void;
  isActive?: boolean;
}

const CONTROLS_OPTIONS: SelectOption<ControlsMode>[] = [
  {
    id: "menu",
    label: "Menu Mode",
    description: "Navigate using arrow keys and select from menus",
  },
  {
    id: "keys",
    label: "Key Mode",
    description: "Use keyboard shortcuts for quick actions (vim-style)",
  },
];

function ControlsPreview({ controlsMode }: { controlsMode: ControlsMode }): ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={2}
      paddingY={1}
      flexDirection="column"
    >
      <Text bold>Preview:</Text>
      {controlsMode === "menu" ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Navigation:</Text>
          <Text>{"  "}Up/Down arrows to move</Text>
          <Text>{"  "}Enter to select</Text>
          <Text>{"  "}Escape to go back</Text>
          <Box marginTop={1}>
            <Text dimColor>Example menu:</Text>
          </Box>
          <Text color="green">{"> "}Start Review</Text>
          <Text>{"  "}View History</Text>
          <Text>{"  "}Settings</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Shortcuts:</Text>
          <Text>{"  "}[r] Start Review</Text>
          <Text>{"  "}[h] View History</Text>
          <Text>{"  "}[s] Settings</Text>
          <Text>{"  "}[q] Quit</Text>
          <Box marginTop={1}>
            <Text dimColor>Press the key directly for quick actions</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function ControlsStep({
  mode,
  currentStep,
  totalSteps,
  initialControlsMode,
  onSubmit,
  onBack,
  isActive = true,
}: ControlsStepProps): ReactElement {
  const initialIndex = CONTROLS_MODES.indexOf(initialControlsMode);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  const selectedMode = CONTROLS_OPTIONS[selectedIndex]?.id ?? "menu";

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.return) {
        onSubmit(selectedMode);
      }

      if (input === "b" && onBack) {
        onBack();
      }
    },
    { isActive }
  );

  const footerText =
    mode === "onboarding"
      ? "Arrow keys to select, Enter to continue"
      : onBack
        ? "Arrow keys to select, Enter to save, [b] Back"
        : "Arrow keys to select, Enter to save";

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Controls Mode"
      footer={footerText}
    >
      <Text dimColor>Choose how you want to interact with Stargazer:</Text>

      <Box marginTop={1} flexDirection="row" gap={2}>
        <Box flexDirection="column" width={40}>
          <SelectList
            options={CONTROLS_OPTIONS}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            isActive={isActive}
          />
        </Box>

        <ControlsPreview controlsMode={selectedMode} />
      </Box>
    </WizardFrame>
  );
}
