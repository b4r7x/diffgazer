import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { findNextEnabled, findPrevEnabled } from "../../lib/list-navigation.js";
import { useTheme } from "../../hooks/use-theme.js";

export interface SelectOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: ReactNode;
}

interface SelectListProps<T extends string = string> {
  options: SelectOption<T>[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSubmit?: (option: SelectOption<T>) => void;
  isActive?: boolean;
}

export function SelectList<T extends string = string>({
  options,
  selectedIndex,
  onSelect,
  onSubmit,
  isActive = true,
}: SelectListProps<T>): ReactElement {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.upArrow && selectedIndex > 0) {
        const newIndex = findPrevEnabled(options, selectedIndex);
        if (newIndex !== -1) onSelect(newIndex);
      }

      if (key.downArrow && selectedIndex < options.length - 1) {
        const newIndex = findNextEnabled(options, selectedIndex);
        if (newIndex !== -1) onSelect(newIndex);
      }

      if (key.return && onSubmit) {
        const option = options[selectedIndex];
        if (option && !option.disabled) {
          onSubmit(option);
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
            <Text
              dimColor={option.disabled}
              strikethrough={option.disabled}
            >
              {option.label}
            </Text>
            {option.badge && (
              <Box marginLeft={1}>{option.badge}</Box>
            )}
          </Box>
          {selectedIndex === index && option.description && (
            <Text dimColor>{"    "}{option.description}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
