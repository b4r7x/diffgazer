import { Box, Text, useInput } from "ink";
import { applyTextEditKey, useInputMode } from "../../hooks/use-input-mode";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
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

  useInputMode(isActive && !disabled);

  const width = Math.min(widthBySize[size], columns - 4);
  const borderColor = error ? tokens.error : tokens.border;
  const isMasked = type === "password";

  function handleChange(next: string) {
    onChange?.(next);
  }

  return (
    <ManualTextEdit
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      width={width}
      borderColor={disabled ? tokens.muted : borderColor}
      isActive={isActive && !disabled}
      mask={isMasked}
      disabled={disabled}
    />
  );
}

interface ManualTextEditProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width: number;
  borderColor: string;
  isActive: boolean;
  mask: boolean;
  disabled: boolean;
}

function ManualTextEdit({
  value,
  onChange,
  placeholder,
  width,
  borderColor,
  isActive,
  mask,
  disabled,
}: ManualTextEditProps) {
  const { tokens } = useTheme();

  useInput(
    (input, key) => {
      const next = applyTextEditKey(value, input, key);
      if (next !== null) onChange(next);
    },
    { isActive },
  );

  const display = mask ? "*".repeat(Array.from(value).length) : value;
  const showPlaceholder = value.length === 0 && placeholder != null;

  return (
    <Box width={width} borderStyle="single" borderColor={borderColor}>
      {showPlaceholder ? (
        <Text color={tokens.muted} dimColor={disabled}>
          {placeholder}
        </Text>
      ) : (
        <Text dimColor={disabled}>{display}</Text>
      )}
    </Box>
  );
}
