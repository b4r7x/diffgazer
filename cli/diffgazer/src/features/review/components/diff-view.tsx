import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";

export interface DiffViewProps {
  patch: string;
}

export function DiffView({ patch }: DiffViewProps) {
  const { tokens } = useTheme();

  // Defense-in-depth: the server already sanitizes suggested_patch, but strip any
  // residual terminal-escape sequences before rendering into the raw terminal.
  const lines = sanitizeTerminalText(patch).split("\n");

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={tokens.border}>
      {lines.map((line, i) => {
        let color = tokens.fg;
        if (line.startsWith("--- ") || line.startsWith("+++ ")) {
          color = tokens.muted;
        } else if (line.startsWith("@@")) {
          color = tokens.accent;
        } else if (line.startsWith("+")) {
          color = tokens.success;
        } else if (line.startsWith("-")) {
          color = tokens.error;
        }

        return (
          <Text key={`${i}:${line}`} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
