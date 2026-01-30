import type { ReactElement } from "react";
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  focused?: boolean;
}

export function Checkbox({
  checked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  focused = false,
}: CheckboxProps): ReactElement {
  const { colors } = useTheme();

  const indicator = checked ? "[x]" : "[ ]";
  const indicatorColor = disabled
    ? colors.ui.textMuted
    : checked
      ? colors.ui.success
      : colors.ui.text;

  return (
    <Box flexDirection="column">
      <Box>
        {focused && (
          <Text color={colors.ui.accent}>{"> "}</Text>
        )}
        {!focused && <Text>{"  "}</Text>}
        <Text color={indicatorColor}>{indicator}</Text>
        {label && (
          <Text
            color={disabled ? colors.ui.textMuted : colors.ui.text}
            dimColor={disabled}
          >
            {" "}{label}
          </Text>
        )}
      </Box>
      {focused && description && (
        <Text dimColor>{"      "}{description}</Text>
      )}
    </Box>
  );
}

export interface CheckboxOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface CheckboxGroupProps<T extends string = string> {
  options: CheckboxOption<T>[];
  value: T[];
  onValueChange: (value: T[]) => void;
  isActive?: boolean;
}

export function CheckboxGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  isActive = true,
}: CheckboxGroupProps<T>): ReactElement {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput(
    (input, key) => {
      if (!isActive) return;

      // Navigation: j/k or arrows
      if ((key.upArrow || input === "k") && focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
      }

      if ((key.downArrow || input === "j") && focusedIndex < options.length - 1) {
        setFocusedIndex(focusedIndex + 1);
      }

      // Toggle: space
      if (input === " ") {
        const option = options[focusedIndex];
        if (option && !option.disabled) {
          const isChecked = value.includes(option.value);
          if (isChecked) {
            onValueChange(value.filter((v) => v !== option.value));
          } else {
            onValueChange([...value, option.value]);
          }
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Checkbox
          key={option.value}
          checked={value.includes(option.value)}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          focused={index === focusedIndex}
        />
      ))}
    </Box>
  );
}

