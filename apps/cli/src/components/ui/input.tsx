import type { ReactElement } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTheme } from "../../hooks/use-theme.js";

type InputSize = "sm" | "md" | "lg";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: InputSize;
  disabled?: boolean;
  focused?: boolean;
  onSubmit?: (value: string) => void;
}

export function Input({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  focused = true,
  onSubmit,
}: InputProps): ReactElement {
  const { colors } = useTheme();

  if (disabled) {
    return (
      <Box>
        <Text color={colors.ui.textMuted} dimColor>
          {value || placeholder}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={colors.ui.border}>[</Text>
      <TextInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        focus={focused}
        onSubmit={onSubmit}
      />
      <Text color={colors.ui.border}>]</Text>
    </Box>
  );
}
