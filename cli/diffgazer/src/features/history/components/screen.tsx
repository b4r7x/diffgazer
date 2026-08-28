import { guardQueryState } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { RunIdLookup } from "@diffgazer/core/format";
import {
  buildHistoryWarningMessages,
  deriveHistoryDetailState,
  getHistoryWarningTargetIds,
  HISTORY_SEARCH_PLACEHOLDER,
  HISTORY_WARNING_TARGET_SAMPLE_SIZE,
  type HistoryWarningSummary,
  summarizeHistoryWarnings,
} from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Callout } from "../../../components/ui/callout";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder, SURFACE_BORDER } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { useHistoryScreen } from "../hooks/use-screen";
import { adjacentHistoryZone } from "../lib/focus-zones";
import { getHistoryFooter } from "../lib/footer";
import {
  computePaneLayout,
  getHistoryWarningBlockRows,
  getHistoryWarningBudget,
  getVisibleHistoryPanes,
} from "../lib/pane-layout";
import { HistoryInsightsPane } from "./insights-pane";
import { RunsList } from "./runs-list";
import { SectionsList } from "./sections-list";

function buildCompactWarningMessages(summary: HistoryWarningSummary): string[] {
  const messages: string[] = [];
  if (summary.unreadableReviewCount > 0) {
    messages.push(`${pluralize(summary.unreadableReviewCount, "saved review")} could not be read.`);
  }
  if (summary.droppedIssueCount > 0) {
    const issueCount = pluralize(summary.droppedIssueCount, "invalid saved issue");
    const verb = summary.droppedIssueCount === 1 ? "was" : "were";
    messages.push(`${issueCount} ${verb} omitted.`);
    messages.push("Re-run the affected reviews for complete results.");
  }
  if (summary.droppedExecutionReviewIds.length > 0) {
    const reviewCount = pluralize(summary.droppedExecutionReviewIds.length, "saved review");
    messages.push(`Execution details for ${reviewCount} could not be read.`);
  }
  if (summary.indexBuildFailed) {
    messages.push("The history index could not be rebuilt; reopen History to retry.");
  }
  if (summary.indexRewriteFailed) {
    messages.push("The history index could not be cleaned up; reopen History to retry.");
  }
  return messages;
}

function HistoryWarnings({
  messages,
  targetIds,
  runIdLookup,
  showTargets,
  warningTargetHint,
  compact,
  detailRows,
  isDetailActive,
}: {
  messages: readonly string[];
  targetIds: readonly string[];
  runIdLookup: RunIdLookup;
  showTargets: boolean;
  warningTargetHint: string | null;
  compact: boolean;
  detailRows: number;
  isDetailActive: boolean;
}) {
  const { tokens } = useTheme();
  if (messages.length === 0) return null;

  if (showTargets && targetIds.length > 0) {
    const scrollRows = Math.max(detailRows - 4, 1);
    return (
      <Box
        borderStyle={SURFACE_BORDER}
        borderColor={tokens.warning}
        paddingX={1}
        flexDirection="column"
        height={detailRows}
        flexShrink={0}
        overflow="hidden"
      >
        <Text bold>History warning · All affected run IDs</Text>
        <ScrollArea height={scrollRows} isActive={isDetailActive}>
          <Box flexDirection="column">
            {targetIds.map((id) => (
              <Text key={id} wrap="wrap">
                {`${runIdLookup.get(id) ?? id} ${id}`}
              </Text>
            ))}
          </Box>
        </ScrollArea>
        <Text color={tokens.muted}>Press w or Esc to hide IDs.</Text>
      </Box>
    );
  }

  return (
    <Callout variant="warning">
      <Callout.Title>
        {compact && warningTargetHint
          ? `History warning · ${warningTargetHint}`
          : "History warning"}
      </Callout.Title>
      {messages.map((message) => (
        <Callout.Content key={message}>{message}</Callout.Content>
      ))}
    </Callout>
  );
}

export function HistoryScreen(): ReactElement {
  const { tokens } = useTheme();
  const { columns, isNarrow } = useResponsive();
  const { contentRows } = useContentZone();
  const { navigate } = useNavigation();
  const [showWarningTargets, setShowWarningTargets] = useState(false);

  const screen = useHistoryScreen({
    onOpenReview: (reviewId) => navigate({ screen: "review", reviewId }),
  });
  const hasLoadedReviews = screen.reviewsQuery.data !== undefined;
  const warnings = screen.reviewsQuery.data?.warnings ?? [];
  const warningSummary = summarizeHistoryWarnings(warnings);
  const warningTargetIds = getHistoryWarningTargetIds(warningSummary);
  const hasWarningTargets = warningTargetIds.length > 0;
  const warningDetailFocused = showWarningTargets && hasWarningTargets;
  const interactionMode = warningDetailFocused ? "warning-detail" : screen.interactionMode;

  const insightsDetailState = deriveHistoryDetailState({
    isLoading: screen.reviewDetailQuery.isLoading,
    error: screen.reviewDetailQuery.error,
    refetch: screen.reviewDetailQuery.refetch,
  });

  useBackHandler({
    isActive: interactionMode !== "search" && interactionMode !== "warning-detail",
  });

  const footer = getHistoryFooter(interactionMode, insightsDetailState.status);
  const shortcuts =
    screen.retainedError?.kind === "refetch" && interactionMode !== "warning-detail"
      ? [...footer.shortcuts, { key: "R", label: "Retry History" }]
      : footer.shortcuts;
  usePageFooter({ shortcuts, rightShortcuts: footer.rightShortcuts });

  useInput(
    (_input, key) => {
      if (screen.interactionMode === "search") return;
      if (key.tab) {
        screen.cycleFocusZone();
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        const zone = adjacentHistoryZone(
          screen.focusZone,
          key.rightArrow ? 1 : -1,
          screen.availableZones,
        );
        if (zone) screen.setFocusZone(zone);
      }
    },
    {
      isActive:
        interactionMode !== "search" &&
        interactionMode !== "route" &&
        interactionMode !== "warning-detail",
    },
  );

  useInput(
    (_input, key) => {
      if (key.escape) {
        screen.clearSearchAndFocusRuns();
        return;
      }
      if (key.downArrow) {
        screen.setFocusZone("timeline");
        return;
      }
    },
    { isActive: interactionMode === "search" },
  );

  useInput(
    (input) => {
      if (input === "R") void screen.reviewsQuery.refetch();
    },
    { isActive: interactionMode !== "warning-detail" && screen.retainedError?.kind === "refetch" },
  );

  useInput(
    (input) => {
      if (warningDetailFocused) {
        if (input === "w") setShowWarningTargets(false);
        return;
      }
      if (input === "/") {
        screen.setFocusZone("search");
      }
      if (input === "o" && screen.selectedRunId) {
        screen.handleRunActivate(screen.selectedRunId);
      }
      if (input === "l" && screen.hasMoreReviews && !screen.isLoadingMoreReviews) {
        void screen.loadMoreReviews();
      }
      if (input === "w" && hasWarningTargets) {
        setShowWarningTargets((visible) => !visible);
      }
    },
    {
      isActive: interactionMode !== "search" && (interactionMode !== "route" || hasWarningTargets),
    },
  );

  useInput(
    (_input, key) => {
      if (warningDetailFocused && key.escape) setShowWarningTargets(false);
    },
    { isActive: warningDetailFocused },
  );

  const guard = hasLoadedReviews
    ? null
    : guardQueryState(screen.reviewsQuery, {
        loading: () => (
          <Box flexDirection="column" gap={1}>
            <SectionHeader bordered>History</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Spinner label="Loading runs..." />
            </Box>
          </Box>
        ),
        error: (err) => (
          <Box flexDirection="column" gap={1}>
            <SectionHeader bordered>History</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
            </Box>
          </Box>
        ),
      });

  if (guard) return guard;

  let retainedErrorCallout: ReactElement | null = null;
  let retainedErrorMessage: string | null = null;
  if (screen.retainedError) {
    const message = sanitizeTerminalText(screen.retainedError.message);
    switch (screen.retainedError.kind) {
      case "pagination":
        retainedErrorMessage = `Could not load older runs. ${message} Press l to retry.`;
        retainedErrorCallout = (
          <Callout variant="error">
            <Callout.Title>Older runs unavailable</Callout.Title>
            <Callout.Content>{retainedErrorMessage ?? ""}</Callout.Content>
          </Callout>
        );
        break;
      case "refetch":
        retainedErrorMessage = `Could not refresh the review list. ${message} Press R to retry.`;
        retainedErrorCallout = (
          <Callout variant="error">
            <Callout.Title>History refresh failed</Callout.Title>
            <Callout.Content>{retainedErrorMessage ?? ""}</Callout.Content>
          </Callout>
        );
        break;
      default: {
        const exhaustive: never = screen.retainedError;
        return exhaustive;
      }
    }
  }

  const salvagedRunIds = new Set(warningSummary.droppedIssueReviewIds);
  const warningMessages = buildHistoryWarningMessages(warningSummary, screen.runIdLookup, {
    maxTargetIds: HISTORY_WARNING_TARGET_SAMPLE_SIZE,
  });
  const compactWarningMessages = buildCompactWarningMessages(warningSummary);
  const warningTargetHint =
    warningTargetIds.length > 0
      ? `Press w to ${showWarningTargets ? "hide" : "view"} all affected run IDs.`
      : null;
  const fullCollapsedWarningMessages = warningTargetHint
    ? [...warningMessages, warningTargetHint]
    : warningMessages;
  const hasVisibleSalvagedRun = screen.mappedRuns.some((run) => salvagedRunIds.has(run.id));
  const requiredRunsRows = hasVisibleSalvagedRun && warningTargetIds.length > 0 ? 2 : 0;
  const retainedErrorRows = retainedErrorMessage
    ? getHistoryWarningBlockRows([retainedErrorMessage], columns)
    : 0;
  const warningBudget = getHistoryWarningBudget(contentRows, requiredRunsRows, retainedErrorRows);
  const fullCollapsedWarningRows = getHistoryWarningBlockRows(
    fullCollapsedWarningMessages,
    columns,
  );
  const compactWarningRows = getHistoryWarningBlockRows(compactWarningMessages, columns);
  const compactWarnings =
    !showWarningTargets &&
    warningTargetIds.length > 0 &&
    fullCollapsedWarningRows > warningBudget &&
    compactWarningRows <= warningBudget;
  let renderedWarningMessages = fullCollapsedWarningMessages;
  if (showWarningTargets) {
    renderedWarningMessages = warningMessages;
  } else if (compactWarnings) {
    renderedWarningMessages = compactWarningMessages;
  }
  const warningBlockRows = showWarningTargets
    ? Math.min(fullCollapsedWarningRows, warningBudget)
    : getHistoryWarningBlockRows(renderedWarningMessages, columns);
  const warningDetailRows = Math.max(warningBlockRows - 1, 1);
  const {
    sectionsWidth,
    insightsWidth,
    sectionsPaneWidth,
    runsPaneWidth,
    paneHeight,
    paneSlotHeight,
    listHeight,
    insightScrollHeight,
    canStackPanes,
  } = computePaneLayout({
    columns,
    isNarrow,
    contentRows,
    warningCount: renderedWarningMessages.length + (retainedErrorCallout ? 1 : 0),
    warningRows: warningBlockRows + retainedErrorRows,
  });

  if (!screen.hasReviews && !screen.hasMoreReviews) {
    return (
      <Box flexDirection="column" gap={1}>
        <SectionHeader bordered>History</SectionHeader>
        <HistoryWarnings
          messages={renderedWarningMessages}
          targetIds={warningTargetIds}
          runIdLookup={screen.runIdLookup}
          showTargets={showWarningTargets}
          warningTargetHint={warningTargetHint}
          compact={compactWarnings}
          detailRows={warningDetailRows}
          isDetailActive={warningDetailFocused}
        />
        {retainedErrorCallout}
        <Box justifyContent="center" paddingY={2}>
          <EmptyState>
            <EmptyState.Message>{screen.emptyRunsMessage}</EmptyState.Message>
            <EmptyState.Description>Run a review to see it here</EmptyState.Description>
          </EmptyState>
        </Box>
      </Box>
    );
  }

  const {
    sections: showSections,
    runs: showRuns,
    insights: showInsights,
  } = getVisibleHistoryPanes(screen.focusZone, canStackPanes);

  return (
    <Box flexDirection="column" gap={1}>
      <SectionHeader bordered>History</SectionHeader>
      <HistoryWarnings
        messages={renderedWarningMessages}
        targetIds={warningTargetIds}
        runIdLookup={screen.runIdLookup}
        showTargets={showWarningTargets}
        warningTargetHint={warningTargetHint}
        compact={compactWarnings}
        detailRows={warningDetailRows}
        isDetailActive={warningDetailFocused}
      />
      {retainedErrorCallout}
      <Box>
        <Input
          value={screen.searchQuery}
          onChange={screen.setSearchQuery}
          placeholder={HISTORY_SEARCH_PLACEHOLDER}
          size="lg"
          isActive={interactionMode === "search"}
        />
      </Box>
      <Box flexDirection={isNarrow ? "column" : "row"} height={paneHeight} overflow="hidden">
        {showSections ? (
          <Box
            width={isNarrow ? undefined : sectionsWidth}
            height={paneSlotHeight}
            {...paneBorder(tokens, screen.focusZone === "timeline")}
            flexDirection="column"
          >
            <Box paddingX={1} paddingTop={1}>
              <SectionHeader variant="muted">Sections</SectionHeader>
            </Box>
            <SectionsList
              items={screen.timelineItems}
              selectedId={screen.selectedDateId}
              onSelect={(id) => {
                screen.setFocusZone("timeline");
                screen.setSelectedDateId(id);
              }}
              onHighlightChange={screen.setSelectedDateId}
              onNavigationBoundaryReached={(direction) => {
                if (direction === -1) screen.setFocusZone("search");
              }}
              isActive={interactionMode === "timeline"}
              height={listHeight}
              width={Math.max(sectionsPaneWidth - 2, 1)}
            />
          </Box>
        ) : null}
        {showRuns ? (
          <Box
            flexGrow={1}
            height={paneSlotHeight}
            {...paneBorder(tokens, screen.focusZone === "runs")}
            flexDirection="column"
          >
            <Box paddingX={1} paddingTop={1}>
              <SectionHeader variant="muted">Runs</SectionHeader>
            </Box>
            <RunsList
              runs={screen.mappedRuns}
              salvagedRunIds={salvagedRunIds}
              selectedId={screen.selectedRunId}
              onSelect={screen.handleRunActivate}
              onHighlightChange={screen.setSelectedRunId}
              onNavigationBoundaryReached={(direction) => {
                if (direction === -1) screen.setFocusZone("search");
              }}
              isActive={interactionMode === "runs" || interactionMode === "load-more"}
              emptyMessage={screen.emptyRunsMessage}
              height={listHeight}
              width={Math.max(runsPaneWidth - 2, 1)}
              hasMore={screen.hasMoreReviews}
              isLoadingMore={screen.isLoadingMoreReviews}
              subZone={screen.runsSubZone}
              onSubZoneChange={screen.setRunsSubZone}
              onLoadMore={() => {
                if (!screen.isLoadingMoreReviews) void screen.loadMoreReviews();
              }}
            />
          </Box>
        ) : null}
        {showInsights ? (
          <Box
            width={isNarrow ? undefined : insightsWidth}
            height={paneSlotHeight}
            {...paneBorder(tokens, screen.focusZone === "insights")}
          >
            <HistoryInsightsPane
              runId={
                screen.selectedRun ? (screen.runIdLookup.get(screen.selectedRun.id) ?? null) : null
              }
              metadata={screen.hasReviews ? screen.selectedRun : null}
              droppedBelowThreshold={screen.reviewDetail?.droppedBelowThreshold}
              minSeverity={screen.reviewDetail?.minSeverity}
              severityCounts={screen.hasReviews ? screen.severityCounts : null}
              issues={screen.hasReviews ? screen.sortedIssues : []}
              detailState={insightsDetailState}
              duration={screen.duration}
              isActive={interactionMode === "insights"}
              scrollHeight={insightScrollHeight}
              onOpenReview={(issueId) => {
                if (!screen.selectedRunId) return;
                navigate({ screen: "review", reviewId: screen.selectedRunId, issueId });
              }}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
