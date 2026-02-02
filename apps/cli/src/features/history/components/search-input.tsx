import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isFocused: boolean;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  isFocused,
  placeholder = "Search runs by ID...",
}: SearchInputProps): ReactElement {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        onChange(value + input);
      }
    },
    { isActive: isFocused }
  );

  const showPlaceholder = !value && !isFocused;

  return (
    <Box>
      <Text color={isFocused ? colors.ui.accent : colors.ui.textMuted}>/ </Text>
      {showPlaceholder ? (
        <Text color={colors.ui.textMuted}>{placeholder}</Text>
      ) : (
        <>
          <Text color={isFocused ? colors.ui.text : colors.ui.textMuted}>{value}</Text>
          {isFocused && <Text color={colors.ui.textMuted}>█</Text>}
        </>
      )}
    </Box>
  );
}
