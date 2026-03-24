import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { useTheme } from "../../theme/theme-context.js";

// --- Types ---

export interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  error?: boolean;
  disabled?: boolean;
  type?: "text" | "password";
  isActive?: boolean;
}

// --- Helpers ---

const widthBySize = {
  sm: 20,
  md: 40,
  lg: 60,
} as const;

// --- Component ---

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
  const [internalValue, setInternalValue] = useState(value ?? "");

  const width = widthBySize[size];
  const borderColor = error ? tokens.error : tokens.border;
  const currentValue = value ?? internalValue;

  if (disabled) {
    const display = type === "password" && currentValue
      ? "*".repeat(currentValue.length)
      : (currentValue || placeholder || "");

    return (
      <Box width={width} borderStyle="single" borderColor={tokens.muted}>
        <Text dimColor>{display}</Text>
      </Box>
    );
  }

  function handleChange(next: string) {
    setInternalValue(next);
    onChange?.(next);
  }

  if (type === "password") {
    return (
      <PasswordInput
        value={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        width={width}
        borderColor={borderColor}
        isActive={isActive}
      />
    );
  }

  return (
    <Box width={width} borderStyle="single" borderColor={borderColor}>
      <TextInput
        placeholder={placeholder}
        defaultValue={value}
        onChange={handleChange}
        isDisabled={!isActive}
      />
    </Box>
  );
}

// --- Password sub-component using raw useInput ---

function PasswordInput({
  value,
  onChange,
  placeholder,
  width,
  borderColor,
  isActive,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width: number;
  borderColor: string;
  isActive: boolean;
}) {
  const { tokens } = useTheme();

  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.return || key.escape || key.upArrow || key.downArrow || key.tab) {
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta) {
        onChange(value + input);
      }
    },
    { isActive },
  );

  const masked = "*".repeat(value.length);
  const showPlaceholder = value.length === 0 && placeholder != null;

  return (
    <Box width={width} borderStyle="single" borderColor={borderColor}>
      {showPlaceholder ? (
        <Text color={tokens.muted}>{placeholder}</Text>
      ) : (
        <Text>{masked}</Text>
      )}
    </Box>
  );
}
