import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";

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
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.upArrow && selectedIndex > 0) {
        onSelect(selectedIndex - 1);
      }

      if (key.downArrow && selectedIndex < options.length - 1) {
        onSelect(selectedIndex + 1);
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
            <Text color={selectedIndex === index ? "green" : undefined}>
              {selectedIndex === index ? "> " : "  "}
            </Text>
            <Text color={option.enabled ? "green" : "gray"}>
              [{option.enabled ? "x" : " "}]
            </Text>
            <Text> {option.label}</Text>
          </Box>
          {selectedIndex === index && option.description && (
            <Text dimColor>{"      "}{option.description}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
