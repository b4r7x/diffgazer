import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { SeverityBreakdown } from "./severity-breakdown.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import { calculateSeverityCounts, SEVERITY_ORDER } from "@diffgazer/schemas/ui";

export interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null | undefined;
  durationMs: number | undefined;
  onContinue?: () => void;
  onBack?: () => void;
}

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  onContinue,
  onBack,
}: ReviewSummaryViewProps) {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (key.return && onContinue) {
        onContinue();
      }
      if (key.escape && onBack) {
        onBack();
      }
    },
    { isActive: true },
  );

  const total = issues.length;
  const filesAnalyzed = new Set(issues.map((i) => i.file)).size;
  const severityCounts = calculateSeverityCounts(issues);

  const severityItems = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: severityCounts[severity],
  }));

  const durationSeconds =
    durationMs !== undefined ? (durationMs / 1000).toFixed(1) : undefined;

  return (
    <Box flexDirection="column" gap={1}>
      <SectionHeader bordered>
        {`Review Summary${reviewId ? ` #${reviewId}` : ""}`}
      </SectionHeader>

      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Box gap={1}>
          <Text color={tokens.muted}>Total issues:</Text>
          <Badge variant={total > 0 ? "warning" : "success"}>
            {String(total)}
          </Badge>
        </Box>

        <Box gap={1}>
          <Text color={tokens.muted}>Files analyzed:</Text>
          <Text color={tokens.fg}>{filesAnalyzed}</Text>
        </Box>

        {durationSeconds !== undefined ? (
          <Box gap={1}>
            <Text color={tokens.muted}>Duration:</Text>
            <Text color={tokens.fg}>{durationSeconds}s</Text>
          </Box>
        ) : null}

        {total > 0 ? (
          <Box flexDirection="column" paddingTop={1}>
            <SectionHeader variant="muted">Breakdown</SectionHeader>
            <SeverityBreakdown issues={severityItems} />
          </Box>
        ) : null}
      </Box>

      <Box gap={2} marginTop={1}>
        {onContinue ? (
          <Button variant="primary" isActive onPress={onContinue}>
            View Results (Enter)
          </Button>
        ) : null}
        {onBack ? (
          <Button variant="secondary" onPress={onBack}>
            Back (Esc)
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
