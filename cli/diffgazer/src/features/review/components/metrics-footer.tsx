import { formatTime } from "@diffgazer/core/format";
import {
  buildReviewMetricsRows,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";

export interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  elapsed: number;
}

export function ReviewMetricsFooter({ metrics, elapsed }: ReviewMetricsFooterProps) {
  const { tokens } = useTheme();
  const rows = buildReviewMetricsRows(metrics, formatTime(elapsed));

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={tokens.border} paddingX={1}>
      {rows.map((row) => {
        let color = tokens.fg;
        if (row.id === "elapsed") color = tokens.info;
        if (row.id === "issues-found" && metrics.issuesFound > 0) color = tokens.warning;

        return (
          <Text key={row.id}>
            <Text color={tokens.muted}>{row.label}: </Text>
            <Text color={color}>{row.value}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
