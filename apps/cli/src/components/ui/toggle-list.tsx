import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface ToggleOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  enabled: boolean;
}

interface ToggleListProps<T extends string = string> {
  options: ToggleOption<T>[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onToggle: (id: T, enabled: boolean) => void;
  isActive?: boolean;
}

export function ToggleList<T extends string = string>({
  options,
  selectedIndex,
  onSelect,
  onToggle,
  isActive = true,
}: ToggleListProps<T>): ReactElement {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (key.upArrow && selectedIndex > 0) {
        onSelect(selectedIndex - 1);
        return;
      }

      if (key.downArrow && selectedIndex < options.length - 1) {
        onSelect(selectedIndex + 1);
        return;
      }

      if (input === " ") {
        const option = options[selectedIndex];
        if (option) {
          onToggle(option.id, !option.enabled);
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Box key={option.id} flexDirection="column">
          <Box>
            <Text color={selectedIndex === index ? colors.ui.accent : undefined}>
              {selectedIndex === index ? "> " : "  "}
            </Text>
            <Text color={option.enabled ? colors.ui.success : colors.ui.textMuted}>
              [{option.enabled ? "x" : " "}]
            </Text>
            <Text> {option.label}</Text>
          </Box>
          {option.description && (
            <Box marginLeft={6}>
              <Text dimColor>{option.description}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
