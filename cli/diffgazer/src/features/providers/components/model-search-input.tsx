import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, Text, useInput } from "ink";
import { useInputMode } from "../../../hooks/use-input-mode";
import { applyTextEditKey } from "../../../lib/text-edit-key";
import { focusBorder, SURFACE_BORDER } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
}

export function ModelSearchInput({ value, onChange, isActive }: ModelSearchInputProps) {
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
      <Box borderStyle={SURFACE_BORDER} borderColor={focusBorder(tokens, isActive)} flexGrow={1}>
        {value ? (
          <Text wrap="truncate-start">
            {sanitizeTerminalText(value)}
            <Text color={isActive ? tokens.fg : tokens.muted}>{isActive ? "\u2588" : ""}</Text>
          </Text>
        ) : (
          <Text color={tokens.muted}>Search models...{isActive ? "\u2588" : ""}</Text>
        )}
      </Box>
    </Box>
  );
}
