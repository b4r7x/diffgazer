import type { SeverityBreakdownRow } from "@diffgazer/core/review";
import { Box, Text } from "ink";
import { useTheme } from "../../../../theme/provider";
import { severityColor } from "../../../../theme/severity";

export interface RibbonSegment {
  severity: SeverityBreakdownRow["severity"];
  cells: number;
}

/**
 * Splits the ribbon across the severities present in the run. The row is
 * exactly `width` cells wide — the ribbon is 100% of the run, so there is no
 * empty track to draw — and every severity that gets a segment gets at least
 * one cell, with the remainder settled by largest fractional part. A row
 * narrower than the number of present severities cannot hold them all, so it
 * keeps the first `width` in severity order and drops the rest.
 */
export function allocateRibbonCells(rows: SeverityBreakdownRow[], width: number): RibbonSegment[] {
  const present = rows.filter((row) => row.count > 0);
  if (present.length === 0 || width <= 0) return [];

  const total = present.reduce((sum, row) => sum + row.count, 0);
  const capped = Math.min(present.length, width);
  const segments = present.slice(0, capped).map((row) => {
    const exact = (row.count / total) * width;
    return { severity: row.severity, cells: Math.max(Math.floor(exact), 1), remainder: exact % 1 };
  });

  let spare = width - segments.reduce((sum, segment) => sum + segment.cells, 0);
  const byRemainder = [...segments].sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (spare > 0 && byRemainder.length > 0) {
    const segment = byRemainder[index % byRemainder.length];
    if (segment) segment.cells += 1;
    spare -= 1;
    index += 1;
  }
  while (spare < 0) {
    const widest = segments.reduce((a, b) => (b.cells > a.cells ? b : a));
    if (widest.cells === 1) break;
    widest.cells -= 1;
    spare += 1;
  }

  return segments.map(({ severity, cells }) => ({ severity, cells }));
}

export interface SeverityRibbonProps {
  rows: SeverityBreakdownRow[];
  width: number;
}

export function SeverityRibbon({ rows, width }: SeverityRibbonProps) {
  const { tokens } = useTheme();
  const segments = allocateRibbonCells(rows, width);

  return (
    <Box>
      {segments.map((segment) => (
        <Text key={segment.severity} color={severityColor(segment.severity, tokens)}>
          {"█".repeat(segment.cells)}
        </Text>
      ))}
    </Box>
  );
}
