import { formatTime } from "@diffgazer/core/format";
import {
  buildReviewMetricsRows,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { SURFACE_BORDER } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

export interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  elapsed: number;
}

/**
 * Rows the footer occupies: one per metric plus the top and bottom border.
 * Counted from the row builder so adding a metric widens the layout reserve in
 * `progress-view/overview` instead of silently clipping the box open.
 */
export const REVIEW_METRICS_FOOTER_ROWS =
  buildReviewMetricsRows({ filesProcessed: 0, filesTotal: 0, issuesFound: 0 }, 0).length + 2;

export function ReviewMetricsFooter({ metrics, elapsed }: ReviewMetricsFooterProps) {
  const { tokens } = useTheme();
  const rows = buildReviewMetricsRows(metrics, formatTime(elapsed));

  return (
    <Box
      flexDirection="column"
      borderStyle={SURFACE_BORDER}
      borderColor={tokens.border}
      paddingX={1}
    >
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
