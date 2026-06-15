import { Box, Text, useInput } from "ink";
import { applyTextEditKey, useInputMode } from "../../../hooks/use-input-mode";
import { useTheme } from "../../../theme/provider";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
}

export function SearchInput({ value, onChange, isActive }: SearchInputProps) {
  const { tokens } = useTheme();

  useInputMode(isActive);

  useInput(
    (input, key) => {
      const next = applyTextEditKey(value, input, key);
      if (next !== null) onChange(next);
    },
    { isActive },
  );

  return (
    <Box>
      <Text color={tokens.muted}>/ </Text>
      <Box borderStyle="single" borderColor={isActive ? tokens.accent : tokens.border} flexGrow={1}>
        {value ? (
          <Text>
            {value}
            <Text color={isActive ? tokens.fg : tokens.muted}>{isActive ? "\u2588" : ""}</Text>
          </Text>
        ) : (
          <Text color={tokens.muted}>Search models...{isActive ? "\u2588" : ""}</Text>
        )}
      </Box>
    </Box>
  );
}
