import { usePageFooter } from "@diffgazer/core/footer";
import { formatDuration, formatRunId } from "@diffgazer/core/format";
import {
  buildCategoryStats,
  buildCompletionHeadline,
  buildDroppedFindingsNotice,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildMissingLensIssuesNotice,
  buildReviewSummary,
  buildTerminalCoverageLine,
  describeTerminalOutcome,
  type FailedTerminalOutcome,
  getLensCoverage,
  isCleanRun,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Callout } from "../../../components/ui/callout";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { useActionRow } from "../../../hooks/use-action-row";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { CategoryStatsTable } from "./category-stats-table";
import { CleanRunView } from "./clean-run-view";
import { IssuePreviewItem } from "./issue-preview-item";
import { type ReviewRunFacts, RunReceiptLedger } from "./run-receipt";
import { SeverityBreakdown } from "./severity/breakdown";

export interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null | undefined;
  durationMs: number | undefined;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  /** Set for a run that ended on a terminal outcome, so the summary reads as the failure it was. */
  terminalOutcome?: FailedTerminalOutcome;
  /** Scope, model and timing of the run, for the receipt ledger. */
  runFacts?: ReviewRunFacts;
  onContinue?: () => void;
  /** Re-runs the same scope. Absent for a saved run, whose diff has moved on. */
  onRunAgain?: () => void;
  /** Names where Back leads, since the clean state spends a button on it. */
  backLabel?: string;
  onBack?: () => void;
}

const SUMMARY_SCROLL_SHORTCUT: Shortcut = { key: "↑/↓", label: "Scroll" };
const SUMMARY_SHORTCUTS_LEFT: Shortcut[] = [
  SUMMARY_SCROLL_SHORTCUT,
  { key: "Enter", label: "View Results" },
];
const SUMMARY_SHORTCUTS_RIGHT: Shortcut[] = [BACK_SHORTCUT];
const ACTIONS_SHORTCUT: Shortcut = { key: "Left/Right", label: "Actions" };
const RUN_AGAIN_LABEL = "Run Again";
// Header rule only: the shortcut bar is the single action surface, so the view
// spends no rows restating [Enter] View Results as a button.
const SUMMARY_FIXED_ROWS = 2;

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  lensStats,
  droppedDuplicates,
  droppedBelowThreshold,
  minSeverity,
  terminalOutcome,
  runFacts,
  onContinue,
  onRunAgain,
  backLabel = "Back to Home",
  onBack,
}: ReviewSummaryViewProps): ReactElement {
  const { tokens } = useTheme();
  const { isNarrow } = useResponsive();
  const { contentColumns, contentRows } = useContentZone();

  const failure = terminalOutcome ? describeTerminalOutcome(terminalOutcome) : null;
  // There is no entry into emptiness: with no findings the results screen has
  // nothing to open, whether the run failed or passed clean.
  const viewResults = issues.length > 0 ? onContinue : undefined;
  const isClean = isCleanRun({ issueCount: issues.length, lensStats, terminalOutcome });

  // The clean state has no results behind it, so it carries its own way out.
  const cleanActions: { label: string; run: () => void }[] = [];
  if (isClean && onRunAgain) cleanActions.push({ label: RUN_AGAIN_LABEL, run: onRunAgain });
  if (isClean && onBack) cleanActions.push({ label: backLabel, run: onBack });
  const actionRow = useActionRow({
    actionCount: cleanActions.length,
    isActive: isClean,
    onAction: (index) => cleanActions[index]?.run(),
  });
  const activeActionLabel = cleanActions[actionRow.activeIndex]?.label;

  function getShortcuts(): Shortcut[] {
    if (isClean) {
      if (!activeActionLabel) return [];
      const move = cleanActions.length > 1 ? [ACTIONS_SHORTCUT] : [];
      return [...move, { key: "Enter", label: activeActionLabel }];
    }
    return viewResults ? SUMMARY_SHORTCUTS_LEFT : [SUMMARY_SCROLL_SHORTCUT];
  }

  usePageFooter({
    shortcuts: getShortcuts(),
    rightShortcuts: onBack ? SUMMARY_SHORTCUTS_RIGHT : [],
  });

  // The clean state's focused button owns Enter, so this handler leaves it alone.
  useInput((_input, key) => {
    if (key.return && viewResults) {
      viewResults();
      return;
    }
    if (key.escape && onBack) onBack();
  });

  const summary = buildReviewSummary(issues);
  const categoryStats = buildCategoryStats(issues);
  const topIssues = issues.slice(0, 3);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, summary.total);
  const hiddenNotice = buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity);
  const lensRows = buildLensSummaryRows(lensStats);
  const missingLensIssues = failure ? buildMissingLensIssuesNotice(lensStats) : "";
  const droppedFindingsNotice = buildDroppedFindingsNotice(terminalOutcome);

  const width = Math.min(contentColumns, 100);
  const sectionWidth = isNarrow ? width : Math.max(Math.floor((width - 2) / 2), 1);
  const scrollHeight = Math.max(contentRows - SUMMARY_FIXED_ROWS, 1);
  const reviewIdLabel = reviewId ? formatRunId(reviewId) : "#unknown";
  const headline = failure ? failure.title : buildCompletionHeadline(lensStats);
  const receipt = {
    ...runFacts,
    lenses: runFacts?.lenses ?? lensRows.map((row) => row.lensId),
    runLabel: reviewIdLabel,
    durationMs,
  };

  return (
    <Box justifyContent="center" height={contentRows} overflow="hidden">
      <Box flexDirection="column" width={width} height={contentRows} overflow="hidden">
        {/* Only a failed run keeps its id in the header: everywhere else the
            receipt's run row carries it. */}
        <SectionHeader bordered>
          {failure ? `${headline} ${reviewIdLabel}` : headline}
        </SectionHeader>
        <ScrollArea height={scrollHeight} isActive>
          {isClean ? (
            <CleanRunView
              receipt={receipt}
              droppedBelowThreshold={droppedBelowThreshold}
              minSeverity={minSeverity}
              notices={[duplicateNotice, hiddenNotice].filter((notice) => notice !== null)}
              actions={cleanActions.map((action, index) => ({
                label: action.label,
                isActive: actionRow.isActionActive(index),
                onPress: () => actionRow.activate(index),
              }))}
            />
          ) : (
            <>
              <Box flexDirection="column" paddingTop={1}>
                {failure ? (
                  <Callout variant="error">
                    <Callout.Content>{failure.message}</Callout.Content>
                    {/* Elapsed time keeps its own row below, so the shared line omits it. */}
                    <Callout.Content>
                      {buildTerminalCoverageLine({
                        coverage: getLensCoverage(lensStats),
                        issueCount: issues.length,
                      })}
                    </Callout.Content>
                    {missingLensIssues ? (
                      <Callout.Content>{missingLensIssues}</Callout.Content>
                    ) : null}
                  </Callout>
                ) : (
                  <RunReceiptLedger receipt={receipt} />
                )}
                {summary.blockerCount > 0 ? (
                  <Box marginTop={1}>
                    <Callout variant="error">
                      <Callout.Title>Blockers</Callout.Title>
                      <Callout.Content>{`${pluralize(summary.blockerCount, "blocker")} found.`}</Callout.Content>
                    </Callout>
                  </Box>
                ) : null}
                {failure && durationMs !== undefined ? (
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
                      <SeverityBreakdown
                        counts={summary.severityCounts}
                        contentWidth={sectionWidth}
                      />
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
                    {droppedFindingsNotice ? (
                      <Text color={tokens.muted}>{droppedFindingsNotice}</Text>
                    ) : null}
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
            </>
          )}
        </ScrollArea>
      </Box>
    </Box>
  );
}
