import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { SeverityBreakdown } from "./severity-breakdown.js";

export interface ReviewSummaryViewProps {
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    duration: number;
  };
  onContinue?: () => void;
  onBack?: () => void;
}

export function ReviewSummaryView({
  summary,
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

  const severityItems = Object.entries(summary.bySeverity).map(
    ([severity, count]) => ({ severity, count }),
  );

  const durationSeconds = (summary.duration / 1000).toFixed(1);

  return (
    <Box flexDirection="column" gap={1}>
      <SectionHeader bordered>Review Summary</SectionHeader>

      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Box gap={1}>
          <Text color={tokens.muted}>Total issues:</Text>
          <Badge variant={summary.total > 0 ? "warning" : "success"}>
            {String(summary.total)}
          </Badge>
        </Box>

        <Box gap={1}>
          <Text color={tokens.muted}>Duration:</Text>
          <Text color={tokens.fg}>{durationSeconds}s</Text>
        </Box>

        {severityItems.length > 0 ? (
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
