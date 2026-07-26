import { formatTime } from "@diffgazer/core/format";
import {
  buildReviewMetricsRows,
  type ReviewMetricTone,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { SURFACE_BORDER } from "../../../theme/chrome";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

function toneColor(tone: ReviewMetricTone, tokens: CliColorTokens): string {
  if (tone === "info") return tokens.info;
  if (tone === "warning") return tokens.warning;
  return tokens.fg;
}

export interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  elapsed: number;
  /** Drops the border for a one-line ledger, which can never half-draw. */
  compact?: boolean;
}

/**
 * Rows the footer occupies: one per metric plus the top and bottom border.
 * Counted from the row builder so adding a metric widens the layout reserve in
 * `progress-view/overview` instead of silently clipping the box open.
 */
export const REVIEW_METRICS_FOOTER_ROWS =
  buildReviewMetricsRows({ filesProcessed: 0, filesTotal: 0, issuesFound: 0 }, 0).length + 2;

/** The borderless ledger: one line, whatever the metric count. */
export const REVIEW_METRICS_COMPACT_ROWS = 1;

export function ReviewMetricsFooter({
  metrics,
  elapsed,
  compact = false,
}: ReviewMetricsFooterProps) {
  const { tokens } = useTheme();
  const rows = buildReviewMetricsRows(metrics, formatTime(elapsed));

  if (compact) {
    return (
      <Box height={1} overflow="hidden">
        <Text wrap="truncate-end">
          {rows.map((row, index) => (
            <Text key={row.id}>
              {index > 0 ? <Text color={tokens.muted}>{" \u00b7 "}</Text> : null}
              <Text color={tokens.muted}>{`${row.label} `}</Text>
              <Text color={toneColor(row.tone, tokens)}>{row.value}</Text>
            </Text>
          ))}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle={SURFACE_BORDER}
      borderColor={tokens.border}
      paddingX={1}
    >
      {rows.map((row) => (
        <Text key={row.id}>
          <Text color={tokens.muted}>{row.label}: </Text>
          <Text color={toneColor(row.tone, tokens)}>{row.value}</Text>
        </Text>
      ))}
    </Box>
  );
}
