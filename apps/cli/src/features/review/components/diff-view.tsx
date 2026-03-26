import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";

export interface DiffViewProps {
  patch: string;
}

export function DiffView({ patch }: DiffViewProps) {
  const { tokens } = useTheme();

  const lines = patch.split("\n");

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tokens.border}
    >
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
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
