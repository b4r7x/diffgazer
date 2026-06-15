import { TextInput } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { applyTextEditKey, useInputMode } from "../../hooks/use-input-mode";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
import { useTheme } from "../../theme/provider";

export interface InputProps {
  value?: string;
  defaultValue?: string;
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
  defaultValue,
  onChange,
  placeholder,
  size = "md",
  error = false,
  disabled = false,
  type = "text",
  isActive = false,
}: InputProps) {
  const { tokens } = useTheme();
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const { columns } = useTerminalDimensions();

  useInputMode(isActive);

  const width = Math.min(widthBySize[size], columns - 4);
  const borderColor = error ? tokens.error : tokens.border;
  const currentValue = value ?? internalValue;
  const isMasked = type === "password";

  if (disabled) {
    const display =
      isMasked && currentValue
        ? "*".repeat(currentValue.length)
        : currentValue || placeholder || "";

    return (
      <Box width={width} borderStyle="single" borderColor={tokens.muted}>
        <Text dimColor>{display}</Text>
      </Box>
    );
  }

  function handleChange(next: string) {
    if (value === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
  }

  if (isMasked || value !== undefined) {
    return (
      <ManualTextEdit
        value={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        width={width}
        borderColor={borderColor}
        isActive={isActive}
        mask={isMasked}
      />
    );
  }

  return (
    <Box width={width} borderStyle="single" borderColor={borderColor}>
      <TextInput
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={handleChange}
        isDisabled={!isActive}
      />
    </Box>
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
}

function ManualTextEdit({
  value,
  onChange,
  placeholder,
  width,
  borderColor,
  isActive,
  mask,
}: ManualTextEditProps) {
  const { tokens } = useTheme();

  useInput(
    (input, key) => {
      const next = applyTextEditKey(value, input, key);
      if (next !== null) onChange(next);
    },
    { isActive },
  );

  const display = mask ? "*".repeat(value.length) : value;
  const showPlaceholder = value.length === 0 && placeholder != null;

  return (
    <Box width={width} borderStyle="single" borderColor={borderColor}>
      {showPlaceholder ? <Text color={tokens.muted}>{placeholder}</Text> : <Text>{display}</Text>}
    </Box>
  );
}
