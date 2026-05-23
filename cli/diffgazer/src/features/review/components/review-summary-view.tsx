import { useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Callout } from "../../../components/ui/callout.js";
import { SeverityBreakdown } from "./severity-breakdown.js";
import { LensStatsTable } from "./lens-stats-table.js";
import { IssuePreviewItem } from "./issue-preview-item.js";
import { buildLensStats } from "./summary-view-helpers.js";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { buildReviewSummary } from "@diffgazer/core/review";

export interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null | undefined;
  durationMs: number | undefined;
  onContinue?: () => void;
  onBack?: () => void;
}

const SUMMARY_SHORTCUTS_LEFT: Shortcut[] = [
  { key: "Enter", label: "View Results" },
];
const SUMMARY_SHORTCUTS_RIGHT: Shortcut[] = [{ key: "Esc", label: "Back" }];

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  onContinue,
  onBack,
}: ReviewSummaryViewProps): ReactElement {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();

  usePageFooter({
    shortcuts: onContinue ? SUMMARY_SHORTCUTS_LEFT : [],
    rightShortcuts: onBack ? SUMMARY_SHORTCUTS_RIGHT : [],
  });

  const buttons: Array<() => void> = [];
  if (onContinue) buttons.push(onContinue);
  if (onBack) buttons.push(onBack);

  const [buttonIndex, setButtonIndex] = useState(0);

  useInput((_input, key) => {
    if (key.leftArrow) {
      setButtonIndex(0);
      return;
    }
    if (key.rightArrow) {
      setButtonIndex(Math.min(buttons.length - 1, 1));
      return;
    }
    if (key.return) {
      const action = buttons[buttonIndex];
      action?.();
      return;
    }
    if (key.escape && onBack) onBack();
  });

  const summary = buildReviewSummary(issues);
  const severityItems = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: summary.severityCounts[severity],
  }));
  const lensStats = buildLensStats(issues);
  const topIssues = issues.slice(0, 3);

  const durationSeconds =
    durationMs !== undefined ? (durationMs / 1000).toFixed(1) : undefined;

  const width = Math.min(columns, 100);
  const runId = reviewId ?? "unknown";

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box flexDirection="column" width={width} gap={1}>
        <Box flexDirection="column">
          <SectionHeader bordered>
            {`Analysis Complete #${runId}`}
          </SectionHeader>
          <Box flexDirection="column" paddingTop={1}>
            <Box>
              <Text color={tokens.muted}>Found </Text>
              <Text color={tokens.fg} bold>
                {`${summary.total} issue${summary.total === 1 ? "" : "s"}`}
              </Text>
              <Text color={tokens.muted}> across </Text>
              <Text color={tokens.fg} bold>
                {`${summary.filesAnalyzed} file${summary.filesAnalyzed === 1 ? "" : "s"}`}
              </Text>
              <Text color={tokens.muted}>.</Text>
            </Box>
            {summary.criticalCount > 0 ? (
              <Box marginTop={1}>
                <Callout variant="error">
                  <Callout.Title>Critical Blockers</Callout.Title>
                  <Callout.Content>
                    {`Security lens flagged ${summary.criticalCount} critical blocker${summary.criticalCount === 1 ? "" : "s"}.`}
                  </Callout.Content>
                </Callout>
              </Box>
            ) : null}
            {durationSeconds !== undefined ? (
              <Box>
                <Text color={tokens.muted}>Duration: </Text>
                <Text color={tokens.fg}>{durationSeconds}s</Text>
              </Box>
            ) : null}
          </Box>
        </Box>

        {summary.total > 0 ? (
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="column" width="50%">
              <SectionHeader variant="muted" bordered>
                Severity Breakdown
              </SectionHeader>
              <Box paddingTop={1}>
                <SeverityBreakdown issues={severityItems} />
              </Box>
            </Box>
            <Box flexDirection="column" width="50%">
              <SectionHeader variant="muted" bordered>
                Issues by Lens
              </SectionHeader>
              <Box paddingTop={1}>
                <LensStatsTable lenses={lensStats} />
              </Box>
            </Box>
          </Box>
        ) : null}

        {topIssues.length > 0 ? (
          <Box flexDirection="column">
            <SectionHeader variant="muted" bordered>
              Top Issues Preview
            </SectionHeader>
            <Box flexDirection="column" paddingTop={1}>
              {topIssues.map((issue) => (
                <IssuePreviewItem
                  key={issue.id}
                  severity={issue.severity}
                  filePath={issue.file}
                  title={issue.title}
                />
              ))}
            </Box>
          </Box>
        ) : null}

        <Box gap={2} marginTop={1}>
          {onContinue ? (
            <Button
              variant="primary"
              isActive={buttonIndex === 0}
              onPress={onContinue}
            >
              View Results (Enter)
            </Button>
          ) : null}
          {onBack ? (
            <Button
              variant="secondary"
              isActive={buttonIndex === (onContinue ? 1 : 0)}
              onPress={onBack}
            >
              Back (Esc)
            </Button>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
