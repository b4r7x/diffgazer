import { buildSeverityBreakdownRows } from "@diffgazer/core/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import { SeverityBar } from "./bar";

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  contentWidth?: number;
}

export function SeverityBreakdown({ counts, contentWidth = 27 }: SeverityBreakdownProps) {
  const rows = buildSeverityBreakdownRows(counts);
  const countWidth = Math.max(...rows.map((row) => String(row.count).length));
  const barWidth = Math.max(contentWidth - 8 - countWidth - 2, 1);

  return (
    <Box flexDirection="column">
      {rows.map((row) => {
        const filledCells = row.total > 0 ? Math.round((row.count / row.total) * barWidth) : 0;
        return (
          <SeverityBar
            key={row.severity}
            severity={row.severity}
            count={row.count}
            filledCells={filledCells}
            emptyCells={barWidth - filledCells}
          />
        );
      })}
    </Box>
  );
}
