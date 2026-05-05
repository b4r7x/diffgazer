import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
}

export function SearchInput({ value, onChange, isActive }: SearchInputProps) {
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

  return (
    <Box>
      <Text color={tokens.muted}>/ </Text>
      <Box
        borderStyle="single"
        borderColor={isActive ? tokens.accent : tokens.border}
        flexGrow={1}
      >
        {value ? (
          <Text>{value}<Text color={isActive ? tokens.fg : tokens.muted}>{isActive ? "\u2588" : ""}</Text></Text>
        ) : (
          <Text color={tokens.muted}>Search models...{isActive ? "\u2588" : ""}</Text>
        )}
      </Box>
    </Box>
  );
}
