import { matchQueryState } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import {
  deriveHistoryDetailState,
  getHistoryWarningTargetIds,
  HISTORY_SEARCH_PLACEHOLDER,
  summarizeHistoryWarnings,
} from "@diffgazer/core/review";
import { hasModifierKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { useNavigate } from "@tanstack/react-router";
import { CenteredStatus } from "@/components/shared/centered-status";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { FailureView } from "@/components/shared/failure-view";
import { TrustPanel } from "@/components/shared/trust-panel";
import { HistoryInsightsPane } from "@/features/history/components/insights-pane";
import { HistoryRunsPane } from "@/features/history/components/runs-pane";
import { TimelineList } from "@/features/history/components/timeline-list";
import { HistoryWarnings } from "@/features/history/components/warnings";
import { useHistoryKeyboard } from "@/features/history/hooks/use-keyboard";
import { useHistoryPage } from "@/features/history/hooks/use-page";
import { useConfigData } from "@/hooks/use-config";
import { useFocusWithin } from "@/hooks/use-focus-within";

export function HistoryPage() {
  const { loadState, trust, repoRoot, projectId } = useConfigData();

  if (loadState.status !== "ready") {
    return <ConfigurationStatus status={loadState.status} />;
  }

  const { isTrusted } = deriveTrustStatus({ trust, projectId, repoRoot });

  if (!isTrusted && repoRoot) {
    return <TrustPanel directory={repoRoot} />;
  }

  return <HistoryPageContent />;
}

function HistoryPageContent() {
  const {
    reviewsQuery,
    reviewDetailQuery,
    runIdLookup,
    focusZone,
    searchQuery,
    searchInputRef,
    warningsRef,
    listRetryRef,
    timelineRef,
    runsListRef,
    loadMoreRef,
    insightsListRef,
    retryRef,
    setSearchQuery,
    setFocusZone,
    timelineItems,
    selectedDateId,
    setSelectedDateId,
    selectedRunId,
    setSelectedRunId,
    mappedRuns,
    selectedRun,
    severityCounts,
    cleanRun,
    sortedIssues,
    duration,
    emptyRunsMessage,
    hasSearchQuery,
    hasMoreReviews,
    isLoadingMoreReviews,
    loadMoreReviews,
    handleTimelineBoundary,
    handleRunsBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunSelect,
    handleRunActivate,
    handleIssueClick,
    highlightedIssueId,
    setHighlightedIssueId,
  } = useHistoryPage();
  const navigate = useNavigate();
  const hasLoadedReviews = reviewsQuery.data !== undefined;
  const warnings = reviewsQuery.data?.warnings ?? [];
  const warningSummary = summarizeHistoryWarnings(warnings);
  const warningSummaryTargetIds = getHistoryWarningTargetIds(warningSummary);

  const insightsDetailState = deriveHistoryDetailState({
    isLoading: reviewDetailQuery.isLoading,
    error: reviewDetailQuery.error,
    refetch: reviewDetailQuery.refetch,
  });

  const loadMoreError =
    reviewsQuery.isFetchNextPageError && reviewsQuery.error ? reviewsQuery.error.message : null;

  const listFetchError =
    hasLoadedReviews &&
    reviewsQuery.error &&
    !reviewsQuery.isFetchingNextPage &&
    !reviewsQuery.isFetchNextPageError
      ? reviewsQuery.error.message
      : null;

  const { handOffToChrome } = useHistoryKeyboard({
    enabled: hasLoadedReviews,
    focusZone,
    setFocusZone,
    activeRunId: selectedRunId,
    hasRuns: mappedRuns.length > 0,
    hasMore: hasMoreReviews,
    isLoadingMore: isLoadingMoreReviews,
    hasInsights: insightsDetailState.status === "ready" && sortedIssues.length > 0,
    hasRetry: insightsDetailState.status === "error",
    hasListRetry: listFetchError !== null,
    hasWarnings: warningSummaryTargetIds.length > 0,
    searchInputRef,
    warningsRef,
    listRetryRef,
    timelineRef,
    runsListRef,
    loadMoreRef,
    insightsListRef,
    retryRef,
    highlightedIssueId,
    onHighlightIssue: setHighlightedIssueId,
    onLoadMore: () => void loadMoreReviews(),
    onRetryList: () => void reviewsQuery.refetch(),
  });

  // Pane chrome follows real DOM focus, not the keyboard zone: the zone is
  // already "runs" before anything is focused, so pinning it would bracket a
  // pane nobody is driving.
  const timelineFocus = useFocusWithin<HTMLElement>();
  const runsFocus = useFocusWithin<HTMLElement>();
  const insightsFocus = useFocusWithin<HTMLElement>();

  const warningRegion = (
    <HistoryWarnings
      summary={warningSummary}
      runIdLookup={runIdLookup}
      targetIds={warningSummaryTargetIds}
      warningRef={warningsRef}
      onFocus={() => setFocusZone("warnings")}
      onHandOffToChrome={handOffToChrome}
    />
  );
  const guard = hasLoadedReviews
    ? null
    : matchQueryState(reviewsQuery, {
        loading: () => <CenteredStatus>Loading runs...</CenteredStatus>,
        error: (err) => (
          <FailureView
            title="Reviews Unavailable"
            message={`Diffgazer could not read the review history. ${err.message}`}
            scope="history-error"
            primary={{ label: "Retry", onAction: () => void reviewsQuery.refetch() }}
            secondary={{ label: "Back to Home", onAction: () => void navigate({ to: "/" }) }}
          />
        ),
        success: () => null,
      });

  if (guard) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden px-4 pt-2 pb-2">
        {warningRegion}
        {guard}
      </div>
    );
  }

  // Issue records this build could not decode at read time - a different fact
  // from a lens that answered incompletely, which the run's summary line reports.
  const droppedIssueRunIds = new Set(warningSummary.droppedIssueReviewIds);
  const selectedRunDisplayId = selectedRun ? (runIdLookup.get(selectedRun.id) ?? null) : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pt-2 pb-2">
      {warningRegion}

      {listFetchError ? (
        <div role="alert" className="shrink-0 mb-2 text-sm text-error-text">
          <p>Could not refresh the review list. {listFetchError}</p>
          <Button
            ref={listRetryRef}
            variant="outline"
            size="sm"
            bracket
            className="mt-2"
            onClick={() => void reviewsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <SearchInput
        ref={searchInputRef}
        size="lg"
        value={searchQuery}
        onChange={setSearchQuery}
        onFocus={() => setFocusZone("search")}
        onEscape={handleSearchEscape}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            handleSearchArrowDown();
          } else if (event.key === "ArrowUp") {
            // Only an unmodified ArrowUp the caret cannot use leaves for the
            // header Back button; anywhere else in the value it keeps its
            // native move, and modified arrows stay native everywhere.
            if (hasModifierKey(event)) return;
            const { selectionStart, selectionEnd } = event.currentTarget;
            if (selectionStart === 0 && selectionEnd === 0) {
              event.preventDefault();
              handOffToChrome();
            }
          }
        }}
        placeholder={HISTORY_SEARCH_PLACEHOLDER}
        prefix={
          // The "/" is a keyboard affordance, so it is noise on a touch device.
          <span aria-hidden="true" className="hidden font-bold text-info-text pointer-fine:inline">
            /
          </span>
        }
        // At 375 the placeholder is wider than the field; ellipsize it instead of
        // hard-clipping mid-word.
        inputClassName="text-ellipsis"
      />

      {/*
        Pane count adapts instead of compressing: one column at 375, two at 768
        (SECTIONS becomes a full-width strip so RUNS keeps the width), the full
        three-pane rhythm from 1024. --panel-hairline is raised to the full
        --border token so the pane frames stay legible in GitHub-dark.

        The notched Panel.Label chips overhang their pane by 12px, and this row
        clips (scrolls below md, hides above it), so the clearance comes from the
        row's own pt-4. The panes therefore sit 12px lower than the bare grid would
        place them; that offset is intended, not compensated away.

        Below md the panes stack and the row itself scrolls, so each pane keeps
        its content-based minimum height; `min-h-0` is scoped to md upward,
        where a pane is a fixed-height track that scrolls internally instead.
      */}
      <div
        data-row="history"
        className="mt-2 grid min-h-0 flex-1 gap-x-px gap-y-6 overflow-y-auto pt-4 [--panel-hairline:var(--border)] md:grid-cols-[minmax(0,1fr)_18rem] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden lg:grid-cols-[11rem_minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)]"
      >
        <Panel
          ref={timelineRef}
          as="aside"
          aria-label="Review sections"
          data-pane="timeline"
          focused={timelineFocus.focusWithin}
          {...timelineFocus.props}
          className="flex flex-col md:col-span-2 md:min-h-0 lg:col-span-1"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Sections
          </Panel.Label>
          {/* Capped below lg so the date filter cannot push the first run row off
              the first mobile/tablet viewport. Full-bleed rows: pl-[2px] only
              absorbs the marker rail's -ml-[2px] so row separators and the
              selected rail terminate into the pane border instead of floating. */}
          <ScrollArea overlay className="max-h-40 pl-[2px] pb-2 lg:max-h-none lg:min-h-0 lg:flex-1">
            <TimelineList
              items={timelineItems}
              selectedId={selectedDateId}
              onSelect={(id) => {
                setFocusZone("timeline");
                setSelectedDateId(id);
              }}
              onFocus={() => setFocusZone("timeline")}
              keyboardEnabled={focusZone === "timeline"}
              onBoundaryReached={handleTimelineBoundary}
            />
          </ScrollArea>
        </Panel>

        <Panel
          as="section"
          aria-label="Review runs"
          data-pane="runs"
          focused={runsFocus.focusWithin}
          {...runsFocus.props}
          className="flex min-w-0 flex-col md:min-h-0"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Runs
          </Panel.Label>
          {/* Ordering is fixed, so this reads as a datum: a floating chip on the
              top rule opposite the pane label, not an in-flow control band. */}
          <Panel.Label variant="border" className="left-auto right-4">
            Newest first
          </Panel.Label>
          <HistoryRunsPane
            runs={mappedRuns}
            selectedRunId={selectedRunId}
            droppedIssueRunIds={droppedIssueRunIds}
            emptyRunsMessage={emptyRunsMessage}
            hasSearchQuery={hasSearchQuery}
            hasMoreReviews={hasMoreReviews}
            isLoadingMoreReviews={isLoadingMoreReviews}
            loadMoreError={loadMoreError}
            isFocused={focusZone === "runs"}
            listRef={runsListRef}
            loadMoreRef={loadMoreRef}
            onSelect={handleRunSelect}
            onActivate={handleRunActivate}
            onHighlightChange={setSelectedRunId}
            onBoundaryReached={handleRunsBoundary}
            onFocus={() => setFocusZone("runs")}
            onLoadMore={() => void loadMoreReviews()}
          />
        </Panel>

        <Panel
          as="aside"
          aria-label="Review insights"
          data-pane="insights"
          focused={insightsFocus.focusWithin}
          {...insightsFocus.props}
          className="flex flex-col md:min-h-0"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Insights
            {/* The run hash is data, not a label: keep its real casing. */}
            {selectedRunDisplayId ? (
              <span className="normal-case">{` · ${selectedRunDisplayId}`}</span>
            ) : null}
          </Panel.Label>
          <HistoryInsightsPane
            runId={selectedRun?.id ?? null}
            severityCounts={severityCounts}
            cleanRun={cleanRun}
            issues={sortedIssues}
            detailState={insightsDetailState}
            duration={duration}
            highlightedIssueId={highlightedIssueId}
            isFocused={focusZone === "insights"}
            listRef={insightsListRef}
            retryRef={retryRef}
            onSelectIssue={handleIssueClick}
            onHighlightIssue={setHighlightedIssueId}
            onListFocus={() => setFocusZone("insights")}
            onListBoundaryReached={(direction) => {
              if (direction === "previous") setFocusZone("runs");
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
