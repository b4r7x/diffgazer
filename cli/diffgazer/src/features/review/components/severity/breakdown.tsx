import { buildSeverityBreakdownRows, formatSeverityFilterLabel } from "@diffgazer/core/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTheme } from "../../../../theme/provider";
import { severityColor } from "../../../../theme/severity";
import { SeverityRibbon } from "./ribbon";

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  contentWidth?: number;
}

/**
 * Two rows instead of five: one proportional ribbon of the whole run, then the
 * bracket-chip legend the results filter row already uses. Counts live in the
 * chip text, so nothing here is encoded by colour alone.
 */
export function SeverityBreakdown({ counts, contentWidth = 27 }: SeverityBreakdownProps) {
  const { tokens } = useTheme();
  const rows = buildSeverityBreakdownRows(counts);

  return (
    <Box flexDirection="column">
      <SeverityRibbon rows={rows} width={Math.max(contentWidth, 1)} />
      <Box gap={1} width={Math.max(contentWidth, 1)} flexWrap="wrap">
        {rows.map((row) => (
          <Box key={row.severity} flexShrink={0}>
            <Text color={row.count > 0 ? severityColor(row.severity, tokens) : tokens.muted}>
              {`[${formatSeverityFilterLabel(row.severity, row.count)}]`}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
