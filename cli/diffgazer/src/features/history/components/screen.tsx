import { guardQueryState } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { HISTORY_SEARCH_PLACEHOLDER, summarizeHistoryWarnings } from "@diffgazer/core/review";
import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Callout } from "../../../components/ui/callout";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { useHistoryScreen } from "../hooks/use-screen";
import { getHistoryFooter } from "../lib/footer";
import type { HistoryDetailState } from "../types";
import { HistoryInsightsPane } from "./insights-pane";
import { RunsList } from "./runs-list";
import { SectionsList } from "./sections-list";

function getInsightScrollHeight({
  isNarrow,
  isMedium,
  paneHeight,
}: {
  isNarrow: boolean;
  isMedium: boolean;
  paneHeight: number;
}): number {
  if (isNarrow) return Math.max(Math.floor(paneHeight / 2), 1);
  if (isMedium) return Math.max(paneHeight - 4, 1);
  return paneHeight;
}

function HistoryWarnings({ warnings }: { warnings: readonly ReviewListWarning[] }) {
  const summary = summarizeHistoryWarnings(warnings);
  const hasWarnings =
    summary.unreadableReviewCount > 0 ||
    summary.droppedIssueCount > 0 ||
    summary.indexBuildFailed ||
    summary.indexRewriteFailed;
  if (!hasWarnings) return null;

  return (
    <Callout variant="warning">
      <Callout.Title>History warning</Callout.Title>
      {summary.unreadableReviewCount > 0 ? (
        <Callout.Content>{`${summary.unreadableReviewCount} saved review${summary.unreadableReviewCount === 1 ? "" : "s"} could not be read.`}</Callout.Content>
      ) : null}
      {summary.droppedIssueCount > 0 ? (
        <Callout.Content>{`${summary.droppedIssueCount} invalid saved issue${summary.droppedIssueCount === 1 ? " was" : "s were"} omitted. Re-run the affected reviews for complete results.`}</Callout.Content>
      ) : null}
      {summary.indexBuildFailed ? (
        <Callout.Content>
          The history index could not be rebuilt. Readable reviews are still shown; reopen History
          to retry.
        </Callout.Content>
      ) : null}
      {summary.indexRewriteFailed ? (
        <Callout.Content>
          The history index could not be cleaned up. Readable reviews are still shown; reopen
          History to retry.
        </Callout.Content>
      ) : null}
    </Callout>
  );
}

export function HistoryScreen(): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows, isNarrow, isMedium } = useResponsive();
  const { navigate } = useNavigation();

  const screen = useHistoryScreen({
    onOpenReview: (reviewId) => navigate({ screen: "review", reviewId }),
  });

  let insightsDetailState: HistoryDetailState = { status: "ready" };
  if (screen.reviewDetailQuery.isLoading) {
    insightsDetailState = { status: "loading" };
  } else if (screen.reviewDetailQuery.isError) {
    insightsDetailState = {
      status: "error",
      message: screen.reviewDetailQuery.error.message,
      retry: () => {
        void screen.reviewDetailQuery.refetch();
      },
    };
  }

  useBackHandler({ isActive: screen.interactionMode !== "search" });

  const { shortcuts, rightShortcuts } = getHistoryFooter(
    screen.interactionMode,
    insightsDetailState.status,
  );
  usePageFooter({ shortcuts, rightShortcuts });

  useInput(
    (_input, key) => {
      if (key.tab) {
        screen.cycleFocusZone();
      }
    },
    {
      isActive: screen.interactionMode !== "search" && screen.interactionMode !== "route",
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
    { isActive: screen.interactionMode === "search" },
  );

  useInput(
    (input) => {
      if (input === "/") {
        screen.setFocusZone("search");
      }
      if (input === "o" && screen.selectedRunId) {
        screen.handleRunActivate(screen.selectedRunId);
      }
      if (input === "l" && screen.hasMoreReviews && !screen.isLoadingMoreReviews) {
        void screen.loadMoreReviews();
      }
    },
    {
      isActive: screen.interactionMode !== "search" && screen.interactionMode !== "route",
    },
  );

  const sectionsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.18), 16)
    : Math.max(Math.floor(columns * 0.2), 18);
  const insightsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.32), 26)
    : Math.max(Math.floor(columns * 0.34), 30);
  const contentWidth = Math.max(columns - 4, 1);
  const sectionsPaneWidth = isNarrow ? contentWidth : sectionsWidth;
  const runsPaneWidth = isNarrow
    ? contentWidth
    : Math.max(contentWidth - sectionsWidth - insightsWidth, 1);
  const paneHeight = Math.max(rows - 8, 8);
  const paneSlotHeight = isNarrow ? Math.max(Math.floor(paneHeight / 3), 3) : paneHeight;
  const listHeight = Math.max(paneSlotHeight - 4, 1);
  const insightScrollHeight = getInsightScrollHeight({
    isNarrow,
    isMedium,
    paneHeight: paneSlotHeight,
  });

  const guard = guardQueryState(screen.reviewsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Spinner label="Loading runs..." />
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Text color={tokens.error}>Error: {err.message}</Text>
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  const warnings = screen.reviewsQuery.data?.warnings ?? [];

  if (!screen.hasReviews && !screen.hasMoreReviews) {
    return (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <HistoryWarnings warnings={warnings} />
            <Box justifyContent="center" paddingY={2}>
              <EmptyState>
                <EmptyState.Message>{screen.emptyRunsMessage}</EmptyState.Message>
                <EmptyState.Description>Run a review to see it here</EmptyState.Description>
              </EmptyState>
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Runs</SectionHeader>
          <HistoryWarnings warnings={warnings} />
          <Box>
            <Input
              value={screen.searchQuery}
              onChange={screen.setSearchQuery}
              placeholder={HISTORY_SEARCH_PLACEHOLDER}
              size="lg"
              isActive={screen.focusZone === "search"}
            />
          </Box>
          <Box flexDirection={isNarrow ? "column" : "row"} height={paneHeight} overflow="hidden">
            <Box
              width={isNarrow ? undefined : sectionsWidth}
              height={paneSlotHeight}
              borderStyle="single"
              borderColor={screen.focusZone === "timeline" ? tokens.accent : tokens.border}
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
                isActive={screen.focusZone === "timeline"}
                height={listHeight}
                width={Math.max(sectionsPaneWidth - 2, 1)}
              />
            </Box>
            <Box
              flexGrow={1}
              height={paneSlotHeight}
              borderStyle="single"
              borderColor={screen.focusZone === "runs" ? tokens.accent : tokens.border}
              flexDirection="column"
            >
              <Box paddingX={1} paddingTop={1}>
                <SectionHeader variant="muted">Runs</SectionHeader>
              </Box>
              <RunsList
                runs={screen.mappedRuns}
                selectedId={screen.selectedRunId}
                onSelect={screen.handleRunActivate}
                onHighlightChange={screen.setSelectedRunId}
                isActive={screen.focusZone === "runs"}
                emptyMessage={screen.emptyRunsMessage}
                height={listHeight}
                width={Math.max(runsPaneWidth - 2, 1)}
                hasMore={screen.hasMoreReviews}
                isLoadingMore={screen.isLoadingMoreReviews}
              />
            </Box>
            <Box
              width={isNarrow ? undefined : insightsWidth}
              height={paneSlotHeight}
              borderStyle="single"
              borderColor={screen.focusZone === "insights" ? tokens.accent : tokens.border}
            >
              <HistoryInsightsPane
                runId={screen.selectedRun ? `#${screen.selectedRun.id.slice(0, 4)}` : null}
                severityCounts={screen.hasReviews ? screen.severityCounts : null}
                issues={screen.hasReviews ? screen.sortedIssues : []}
                detailState={insightsDetailState}
                duration={screen.duration}
                isActive={screen.focusZone === "insights"}
                scrollHeight={insightScrollHeight}
                onOpenReview={screen.handleOpenReview}
              />
            </Box>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
