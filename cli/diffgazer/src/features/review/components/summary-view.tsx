import { usePageFooter } from "@diffgazer/core/footer";
import { formatDuration } from "@diffgazer/core/format";
import {
  buildCategoryStats,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
  formatRunId,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useContentZone } from "../../../components/layout/global";
import { SeverityBreakdown } from "../../../components/shared/severity/breakdown";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { useActionRow } from "../../../hooks/use-action-row";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

export interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null | undefined;
  durationMs: number | undefined;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  onContinue?: () => void;
  onBack?: () => void;
}

const SUMMARY_SHORTCUTS_LEFT: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SUMMARY_SHORTCUTS_RIGHT: Shortcut[] = [BACK_SHORTCUT];
const SUMMARY_FIXED_ROWS = 4;

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  lensStats,
  droppedDuplicates,
  droppedBelowThreshold,
  minSeverity,
  onContinue,
  onBack,
}: ReviewSummaryViewProps): ReactElement {
  const { tokens } = useTheme();
  const { isNarrow } = useResponsive();
  const { contentColumns, contentRows } = useContentZone();

  usePageFooter({
    shortcuts: onContinue ? SUMMARY_SHORTCUTS_LEFT : [],
    rightShortcuts: onBack ? SUMMARY_SHORTCUTS_RIGHT : [],
  });

  const actionCallbacks = [onContinue, onBack].filter(
    (callback): callback is () => void => callback !== undefined,
  );
  const actions = useActionRow({
    actionCount: actionCallbacks.length,
    onAction: (index) => actionCallbacks[index]?.(),
  });

  useInput((_input, key) => {
    if (key.escape && onBack) onBack();
  });

  const summary = buildReviewSummary(issues);
  const categoryStats = buildCategoryStats(issues);
  const topIssues = issues.slice(0, 3);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, summary.total);
  const hiddenNotice = buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity);
  const lensRows = buildLensSummaryRows(lensStats);

  const width = Math.min(contentColumns, 100);
  const sectionWidth = isNarrow ? width : Math.max(Math.floor((width - 2) / 2), 1);
  const scrollHeight = Math.max(contentRows - SUMMARY_FIXED_ROWS, 1);
  const reviewIdLabel = reviewId ? formatRunId(reviewId) : "#unknown";

  return (
    <Box justifyContent="center" height={contentRows} overflow="hidden">
      <Box flexDirection="column" width={width} height={contentRows} overflow="hidden">
        <SectionHeader bordered>{`Review Complete ${reviewIdLabel}`}</SectionHeader>
        <ScrollArea height={scrollHeight} isActive>
          <Box flexDirection="column" paddingTop={1}>
            <Box>
              <Text color={tokens.muted}>Found </Text>
              <Text color={tokens.fg} bold>
                {pluralize(summary.total, "issue")}
              </Text>
              <Text color={tokens.muted}> across </Text>
              <Text color={tokens.fg} bold>
                {pluralize(summary.filesWithIssues, "file")} with issues
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

          {summary.total > 0 ? (
            <Box flexDirection={isNarrow ? "column" : "row"} gap={2}>
              <Box flexDirection="column" width={sectionWidth}>
                <SectionHeader variant="muted" bordered>
                  Severity Breakdown
                </SectionHeader>
                <Box paddingTop={1}>
                  <SeverityBreakdown counts={summary.severityCounts} contentWidth={sectionWidth} />
                </Box>
              </Box>
              <Box flexDirection="column" width={sectionWidth}>
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
                    contentWidth={width}
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

          {duplicateNotice ? (
            <Box>
              <Text color={tokens.muted}>{duplicateNotice}</Text>
            </Box>
          ) : null}

          {hiddenNotice ? (
            <Box>
              <Text color={tokens.muted}>{hiddenNotice}</Text>
            </Box>
          ) : null}
        </ScrollArea>

        <Box gap={2} marginTop={1}>
          {onContinue ? (
            <Button
              variant="primary"
              isActive={actions.isActionActive(0)}
              onPress={() => actions.activate(0)}
            >
              View Results (Enter)
            </Button>
          ) : null}
          {onBack ? (
            <Button
              variant="secondary"
              isActive={actions.isActionActive(onContinue ? 1 : 0)}
              onPress={() => actions.activate(onContinue ? 1 : 0)}
            >
              Back (Esc)
            </Button>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
