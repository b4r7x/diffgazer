import { usePageFooter } from "@diffgazer/core/footer";
import { formatDuration } from "@diffgazer/core/format";
import {
  buildCategoryStats,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, SEVERITY_ORDER, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useState } from "react";
import { SeverityBreakdown } from "../../../components/shared/severity/breakdown";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { SectionHeader } from "../../../components/ui/section-header";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

export interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null | undefined;
  durationMs: number | undefined;
  lensStats?: LensStat[];
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  onContinue?: () => void;
  onBack?: () => void;
}

const SUMMARY_SHORTCUTS_LEFT: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SUMMARY_SHORTCUTS_RIGHT: Shortcut[] = [BACK_SHORTCUT];

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  lensStats,
  droppedBelowThreshold,
  minSeverity,
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
  const categoryStats = buildCategoryStats(issues);
  const topIssues = issues.slice(0, 3);
  const hiddenNotice = buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity);
  const lensRows = buildLensSummaryRows(lensStats);

  const width = Math.min(columns, 100);
  const runId = reviewId ?? "unknown";

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box flexDirection="column" width={width} gap={1}>
        <Box flexDirection="column">
          <SectionHeader bordered>{`Review Complete #${runId}`}</SectionHeader>
          <Box flexDirection="column" paddingTop={1}>
            <Box>
              <Text color={tokens.muted}>Found </Text>
              <Text color={tokens.fg} bold>
                {pluralize(summary.total, "issue")}
              </Text>
              <Text color={tokens.muted}> across </Text>
              <Text color={tokens.fg} bold>
                {pluralize(summary.filesAnalyzed, "file")}
              </Text>
              <Text color={tokens.muted}>.</Text>
            </Box>
            {summary.blockerCount > 0 ? (
              <Box marginTop={1}>
                <Callout variant="error">
                  <Callout.Title>Blockers</Callout.Title>
                  <Callout.Content>{`${pluralize(summary.blockerCount, "blocker")} found.`}</Callout.Content>
                </Callout>
              </Box>
            ) : null}
            {durationMs !== undefined ? (
              <Box>
                <Text color={tokens.muted}>Duration: </Text>
                <Text color={tokens.fg}>{formatDuration(durationMs)}</Text>
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
                Issues by Category
              </SectionHeader>
              <Box paddingTop={1}>
                <CategoryStatsTable categories={categoryStats} />
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

        {lensRows.length > 0 ? (
          <Box flexDirection="column">
            <SectionHeader variant="muted" bordered>
              Issues by Lens
            </SectionHeader>
            <Box flexDirection="column" paddingTop={1}>
              {lensRows.map((row) => (
                <Box key={row.lensId} gap={1}>
                  <Text color={tokens.fg}>{row.label}</Text>
                  <Text color={row.status === "failed" ? tokens.error : tokens.muted}>
                    {row.status === "failed"
                      ? `failed${row.errorCode ? ` (${row.errorCode})` : ""}`
                      : pluralize(row.issueCount, "issue")}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {hiddenNotice ? (
          <Box>
            <Text color={tokens.muted}>{hiddenNotice}</Text>
          </Box>
        ) : null}

        <Box gap={2} marginTop={1}>
          {onContinue ? (
            <Button variant="primary" isActive={buttonIndex === 0} onPress={onContinue}>
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
