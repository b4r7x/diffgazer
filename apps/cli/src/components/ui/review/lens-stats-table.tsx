import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import type { LensStats } from "@repo/schemas/ui";

export type { LensStats };

export interface LensStatsTableProps {
  lenses: LensStats[];
}

function ChangeIndicator({ change }: { change: number }): ReactElement {
  const { colors } = useTheme();

  if (change > 0) {
    return (
      <Text color={colors.ui.error}>
        + {change}
      </Text>
    );
  }
  if (change < 0) {
    return (
      <Text color={colors.ui.success}>
        - {Math.abs(change)}
      </Text>
    );
  }
  return <Text color={colors.ui.textMuted}>-</Text>;
}

export function LensStatsTable({ lenses }: LensStatsTableProps): ReactElement {
  const { colors } = useTheme();

  const maxNameLen = Math.max(...lenses.map((l) => l.name.length), 4);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderBottom={false} borderLeft={false} borderRight={false} borderColor={colors.ui.border}>
        <Box width={maxNameLen + 4}>
          <Text color={colors.ui.textMuted} dimColor>
            LENS
          </Text>
        </Box>
        <Box width={8} justifyContent="flex-end">
          <Text color={colors.ui.textMuted} dimColor>
            COUNT
          </Text>
        </Box>
        <Box width={10} justifyContent="flex-end">
          <Text color={colors.ui.textMuted} dimColor>
            CHANGE
          </Text>
        </Box>
      </Box>
      {lenses.map((lens) => (
        <Box key={lens.id}>
          <Box width={maxNameLen + 4}>
            <Text color={lens.iconColor ?? colors.ui.textMuted}>{lens.icon}</Text>
            <Text> </Text>
            <Text color={colors.ui.text}>{lens.name}</Text>
          </Box>
          <Box width={8} justifyContent="flex-end">
            <Text color={colors.ui.text} bold>
              {lens.count}
            </Text>
          </Box>
          <Box width={10} justifyContent="flex-end">
            <ChangeIndicator change={lens.change} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
