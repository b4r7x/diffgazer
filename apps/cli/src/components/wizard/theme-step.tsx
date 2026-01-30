import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "@repo/schemas/settings";
import { THEMES } from "@repo/schemas/settings";
import { SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";

type WizardMode = "onboarding" | "settings";

interface ThemeStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  initialTheme: Theme;
  onSubmit: (theme: Theme) => void;
  onBack?: () => void;
  isActive?: boolean;
}

const THEME_OPTIONS: SelectOption<Theme>[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Automatically detect system theme preference",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Dark theme with light text on dark background",
  },
  {
    id: "light",
    label: "Light",
    description: "Light theme with dark text on light background",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Use terminal default colors without overrides",
  },
];

function ThemePreview({ theme }: { theme: Theme }): ReactElement {
  const previewColors = {
    auto: { bg: undefined, fg: undefined },
    dark: { bg: "black", fg: "white" },
    light: { bg: "white", fg: "black" },
    terminal: { bg: undefined, fg: undefined },
  };

  const colors = previewColors[theme];

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={2}
      paddingY={1}
      flexDirection="column"
    >
      <Text bold>Preview:</Text>
      <Box marginTop={1}>
        <Text backgroundColor={colors.bg} color={colors.fg}>
          {" "}Sample text with {theme} theme{" "}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color="green">+ Added line</Text>
      </Box>
      <Box>
        <Text color="red">- Removed line</Text>
      </Box>
      <Box>
        <Text color="yellow">[warning] Example issue</Text>
      </Box>
    </Box>
  );
}

export function ThemeStep({
  mode,
  currentStep,
  totalSteps,
  initialTheme,
  onSubmit,
  onBack,
  isActive = true,
}: ThemeStepProps): ReactElement {
  const initialIndex = THEMES.indexOf(initialTheme);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  const selectedTheme = THEME_OPTIONS[selectedIndex]?.id ?? "auto";

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.return) {
        onSubmit(selectedTheme);
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

  const frameProps = mode === "settings" ? { width: "66%" as const, centered: true } : {};

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Theme Selection"
      footer={footerText}
      {...frameProps}
    >
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column" width={40}>
          <SelectList
            options={THEME_OPTIONS}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            isActive={isActive}
          />
        </Box>

        <ThemePreview theme={selectedTheme} />
      </Box>
    </WizardFrame>
  );
}
