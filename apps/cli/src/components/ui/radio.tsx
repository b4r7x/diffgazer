import type { ReactElement } from "react";
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface RadioProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  focused?: boolean;
}

export function Radio({
  checked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  focused = false,
}: RadioProps): ReactElement {
  const { colors } = useTheme();

  const indicator = checked ? "(\u25CF)" : "( )";
  const indicatorColor = disabled
    ? colors.ui.textMuted
    : checked
      ? colors.ui.accent
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

export interface RadioOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> {
  options: RadioOption<T>[];
  value?: T;
  onValueChange: (value: T) => void;
  isActive?: boolean;
}

export function RadioGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  isActive = true,
}: RadioGroupProps<T>): ReactElement {
  const [focusedIndex, setFocusedIndex] = useState(() => {
    if (value) {
      const idx = options.findIndex((o) => o.value === value);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

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

      // Select: space or enter
      if (input === " " || key.return) {
        const option = options[focusedIndex];
        if (option && !option.disabled) {
          onValueChange(option.value);
        }
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Radio
          key={option.value}
          checked={value === option.value}
          label={option.label}
          description={option.description}
          disabled={option.disabled}
          focused={index === focusedIndex}
        />
      ))}
    </Box>
  );
}
