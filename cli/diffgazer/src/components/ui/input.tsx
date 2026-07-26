import { Box, Text, useInput } from "ink";
import { useInputMode } from "../../hooks/use-input-mode";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
import { applyTextEditKey } from "../../lib/text-edit-key";
import { SURFACE_BORDER } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";

export interface InputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  error?: boolean;
  disabled?: boolean;
  type?: "text" | "password";
  isActive?: boolean;
}

const widthBySize = {
  sm: 20,
  md: 40,
  lg: 60,
} as const;

export function Input({
  value,
  onChange,
  placeholder,
  size = "md",
  error = false,
  disabled = false,
  type = "text",
  isActive = false,
}: InputProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const editable = isActive && !disabled;

  useInputMode(editable);

  useInput(
    (input, key) => {
      const next = applyTextEditKey(value, input, key);
      if (next !== null) onChange?.(next);
    },
    { isActive: editable },
  );

  const width = Math.min(widthBySize[size], columns - 4);
  const enabledBorderColor = error ? tokens.error : tokens.border;
  const borderColor = disabled ? tokens.muted : enabledBorderColor;
  const display = type === "password" ? "*".repeat(Array.from(value).length) : value;
  const showPlaceholder = value.length === 0 && placeholder != null;

  return (
    <Box width={width} borderStyle={SURFACE_BORDER} borderColor={borderColor}>
      {showPlaceholder ? (
        <Text color={tokens.muted}>{placeholder}</Text>
      ) : (
        <Text color={disabled ? tokens.muted : tokens.fg} wrap="truncate-start">
          {display}
        </Text>
      )}
    </Box>
  );
}
