import type { ReactElement } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTheme } from "../../../hooks/use-theme.js";

interface InputProps {
  /** Current input value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Placeholder text shown when value is empty */
  placeholder?: string;
  /** Width in characters (uses flexGrow if not set) */
  width?: number;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether input has focus and accepts input */
  focus?: boolean;
  /** Mask character for password fields (e.g., "*") */
  mask?: string;
  /** Prefix string to show before the input */
  prefix?: string;
  /** Called when Enter is pressed */
  onSubmit?: (value: string) => void;
}

/**
 * Simple reusable text input - no border, just prefix + input.
 * Wrap in your own Box with borderStyle if you need a border.
 */
export function Input({
  value,
  onChange,
  placeholder = "",
  width,
  disabled = false,
  focus = true,
  mask,
  prefix,
  onSubmit,
}: InputProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box width={width} flexGrow={width ? undefined : 1}>
      {prefix && (
        <Text color={colors.ui.textMuted} dimColor={disabled}>
          {prefix}{" "}
        </Text>
      )}
      {disabled ? (
        <Text color={colors.ui.textMuted} dimColor>
          {value || placeholder}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          focus={focus}
          mask={mask}
          onSubmit={onSubmit}
        />
      )}
    </Box>
  );
}
