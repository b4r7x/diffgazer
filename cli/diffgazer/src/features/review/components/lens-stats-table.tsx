import { Box, Text } from "ink";
import type { LensStats } from "@diffgazer/core/schemas/ui";
import { useTheme } from "../../../theme/theme-context.js";

export type { LensStats };

export interface LensStatsTableProps {
  lenses: LensStats[];
}

export function LensStatsTable({ lenses }: LensStatsTableProps) {
  const { tokens } = useTheme();

  if (lenses.length === 0) {
    return <Text color={tokens.muted}>No lens data</Text>;
  }

  const nameWidth = Math.max(
    "Lens".length,
    ...lenses.map((l) => l.name.length),
  );

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={tokens.muted} bold>
          {"Lens".padEnd(nameWidth)}
        </Text>
        <Text color={tokens.muted} bold>
          Count
        </Text>
      </Box>
      {lenses.map((lens) => (
        <Box key={lens.id} gap={1}>
          <Text color={tokens.fg}>{lens.name.padEnd(nameWidth)}</Text>
          <Text color={tokens.fg} bold>
            {String(lens.count)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
