import { guardQueryState } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { formatRunId } from "@diffgazer/core/format";
import {
  buildHistoryWarningMessages,
  deriveHistoryDetailState,
  HISTORY_SEARCH_PLACEHOLDER,
  summarizeHistoryWarnings,
} from "@diffgazer/core/review";
import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Callout } from "../../../components/ui/callout";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { useHistoryScreen } from "../hooks/use-screen";
import { getHistoryFooter } from "../lib/footer";
import { computePaneLayout, getVisibleHistoryPanes } from "../lib/pane-layout";
import { HistoryInsightsPane } from "./insights-pane";
import { RunsList } from "./runs-list";
import { SectionsList } from "./sections-list";

function HistoryWarnings({ warnings }: { warnings: readonly ReviewListWarning[] }) {
  const messages = buildHistoryWarningMessages(summarizeHistoryWarnings(warnings));
  if (messages.length === 0) return null;

  return (
    <Callout variant="warning">
      <Callout.Title>History warning</Callout.Title>
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

  const screen = useHistoryScreen({
    onOpenReview: (reviewId) => navigate({ screen: "review", reviewId }),
  });

  const insightsDetailState = deriveHistoryDetailState({
    isLoading: screen.reviewDetailQuery.isLoading,
    error: screen.reviewDetailQuery.error,
    refetch: screen.reviewDetailQuery.refetch,
  });

  useBackHandler({ isActive: screen.interactionMode !== "search" });

  const { shortcuts, rightShortcuts } = getHistoryFooter(
    screen.interactionMode,
    insightsDetailState.status,
  );
  usePageFooter({ shortcuts, rightShortcuts });

  useInput(
    (_input, key) => {
      if (screen.interactionMode === "search") return;
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

  const guard = guardQueryState(screen.reviewsQuery, {
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
          <Text color={tokens.error}>Error: {err.message}</Text>
        </Box>
      </Box>
    ),
  });

  if (guard) return guard;

  const warnings = screen.reviewsQuery.data?.warnings ?? [];
  const warningMessages = buildHistoryWarningMessages(summarizeHistoryWarnings(warnings));
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
    warningCount: warningMessages.length,
  });

  if (!screen.hasReviews && !screen.hasMoreReviews) {
    return (
      <Box flexDirection="column" gap={1}>
        <SectionHeader bordered>History</SectionHeader>
        <HistoryWarnings warnings={warnings} />
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
              isActive={screen.focusZone === "timeline"}
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
        ) : null}
        {showInsights ? (
          <Box
            width={isNarrow ? undefined : insightsWidth}
            height={paneSlotHeight}
            {...paneBorder(tokens, screen.focusZone === "insights")}
          >
            <HistoryInsightsPane
              runId={
                screen.selectedRun
                  ? formatRunId(
                      screen.selectedRun.id,
                      screen.reviews.map((review) => review.id),
                    )
                  : null
              }
              severityCounts={screen.hasReviews ? screen.severityCounts : null}
              issues={screen.hasReviews ? screen.sortedIssues : []}
              detailState={insightsDetailState}
              duration={screen.duration}
              isActive={screen.focusZone === "insights"}
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
