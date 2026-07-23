import { matchQueryState } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import {
  buildHistoryWarningMessages,
  deriveHistoryDetailState,
  formatRunId,
  HISTORY_SEARCH_PLACEHOLDER,
  summarizeHistoryWarnings,
} from "@diffgazer/core/review";
import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { isListNavigationKey, toVerticalBoundaryDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { Panel } from "@diffgazer/ui/components/panel";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { type KeyboardEvent, useRef } from "react";
import { CenteredStatus } from "@/components/shared/centered-status";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { TrustPanel } from "@/components/shared/trust-panel";
import { HistoryInsightsPane } from "@/features/history/components/insights-pane";
import { TimelineList } from "@/features/history/components/timeline-list";
import { useHistoryKeyboard } from "@/features/history/hooks/use-keyboard";
import { useHistoryPage } from "@/features/history/hooks/use-page";
import { useConfigData } from "@/hooks/use-config";

function HistoryWarnings({ warnings }: { warnings: readonly ReviewListWarning[] }) {
  const messages = buildHistoryWarningMessages(summarizeHistoryWarnings(warnings));
  if (messages.length === 0) return null;

  return (
    <output className="shrink-0 mb-1 block space-y-1 text-sm text-warning-text">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </output>
  );
}

export function HistoryPage() {
  const { loadState, trust, repoRoot, projectId } = useConfigData();

  if (loadState.status !== "ready") {
    return <ConfigurationStatus status={loadState.status} />;
  }

  const { isTrusted } = deriveTrustStatus({ trust, projectId, repoRoot });

  if (!isTrusted && projectId && repoRoot) {
    return <TrustPanel directory={repoRoot} />;
  }

  return <HistoryPageContent />;
}

function HistoryPageContent() {
  const {
    reviewsQuery,
    reviewDetailQuery,
    focusZone,
    searchQuery,
    searchInputRef,
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
    sortedIssues,
    duration,
    hasReviews,
    emptyRunsMessage,
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

  const timelineRef = useRef<HTMLElement>(null);
  const runsListRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const insightsListRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const activeRunId = selectedRunId;
  const insightsDetailState = deriveHistoryDetailState({
    isLoading: reviewDetailQuery.isLoading,
    error: reviewDetailQuery.error,
    refetch: reviewDetailQuery.refetch,
  });

  useHistoryKeyboard({
    enabled: reviewsQuery.isSuccess,
    focusZone,
    setFocusZone,
    activeRunId,
    hasRuns: mappedRuns.length > 0,
    hasMore: hasMoreReviews,
    hasInsights: insightsDetailState.status === "ready" && sortedIssues.length > 0,
    hasRetry: insightsDetailState.status === "error",
    searchInputRef,
    timelineRef,
    runsListRef,
    loadMoreRef,
    insightsListRef,
    retryRef,
    highlightedIssueId,
    onHighlightIssue: setHighlightedIssueId,
  });

  const handleRunsKeyDown = (event: KeyboardEvent) => {
    if (focusZone !== "runs") {
      if (isListNavigationKey(event.key)) event.preventDefault();
      return;
    }

    if (event.key === " " && activeRunId) {
      event.preventDefault();
      handleRunActivate(activeRunId);
    }
  };

  const guard = matchQueryState(reviewsQuery, {
    loading: () => <CenteredStatus>Loading runs...</CenteredStatus>,
    error: (err) => <CenteredStatus tone="error">Error: {err.message}</CenteredStatus>,
    success: () => null,
  });

  if (guard) return guard;

  const warnings = reviewsQuery.data?.warnings ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pt-2 pb-2">
      <HistoryWarnings warnings={warnings} />

      <SearchInput
        ref={searchInputRef}
        size="sm"
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
          }
        }}
        placeholder={HISTORY_SEARCH_PLACEHOLDER}
        prefix={
          <span aria-hidden="true" className="text-info-text font-bold">
            /
          </span>
        }
        className="border-border bg-background"
      />

      <div
        data-row="history"
        className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto md:flex-row md:overflow-hidden"
      >
        <Panel
          ref={timelineRef}
          as="aside"
          aria-label="Review sections"
          data-pane="timeline"
          data-focused={focusZone === "timeline" || undefined}
          className="mt-3 flex flex-col border border-border data-[focused]:border-info focus:outline-none md:w-48 md:shrink-0"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Sections
          </Panel.Label>
          <div className="px-2 pb-2 pt-3 md:flex-1 md:overflow-y-auto">
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
          </div>
        </Panel>

        <Panel
          as="section"
          aria-label="Review runs"
          data-pane="runs"
          data-focused={focusZone === "runs" || focusZone === "load-more" || undefined}
          className="mt-3 min-w-0 flex flex-col border border-border data-[focused]:border-info focus:outline-none md:flex-1"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Runs
          </Panel.Label>
          <div className="flex justify-end px-3 pt-3">
            <span className="text-2xs text-muted-foreground font-mono">Sort: Recent</span>
          </div>
          <div className="p-2 md:flex-1 md:overflow-y-auto">
            {mappedRuns.length > 0 ? (
              <NavigationList
                ref={runsListRef}
                aria-label="Review runs"
                selectedId={selectedRunId}
                highlighted={focusZone === "runs" ? selectedRunId : null}
                onFocus={() => setFocusZone("runs")}
                onSelect={handleRunSelect}
                onEnter={handleRunActivate}
                onHighlightChange={setSelectedRunId}
                onNavigationBoundaryReached={(direction) => {
                  if (direction === "previous") {
                    handleRunsBoundary(toVerticalBoundaryDirection(direction));
                  }
                }}
                onKeyDown={handleRunsKeyDown}
                wrap={false}
                focused={focusZone === "runs"}
              >
                {mappedRuns.map((run) => (
                  <NavigationList.Item
                    key={run.id}
                    id={run.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <NavigationList.Title>{run.displayId}</NavigationList.Title>
                    <NavigationList.Status className="text-muted-foreground group-data-[highlighted]:text-primary-foreground/70">
                      {run.timestamp}
                    </NavigationList.Status>
                    <NavigationList.Meta className="min-w-0 flex-wrap">
                      <NavigationList.Badge variant="neutral" size="sm">
                        {run.branch}
                      </NavigationList.Badge>
                      <span className="min-w-full line-clamp-2 text-sm text-muted-foreground group-data-[highlighted]:text-primary-foreground/85">
                        {run.summary}
                      </span>
                    </NavigationList.Meta>
                  </NavigationList.Item>
                ))}
              </NavigationList>
            ) : null}
            {/* Live region stays mounted across the runs→empty transition so the
                empty message is announced; empty (and collapsed) while runs exist. */}
            <EmptyState
              variant="inline"
              size="sm"
              live
              className={mappedRuns.length === 0 ? "h-full" : "p-0"}
            >
              {mappedRuns.length === 0 ? emptyRunsMessage : null}
            </EmptyState>
            {hasMoreReviews ? (
              <button
                ref={loadMoreRef}
                type="button"
                disabled={isLoadingMoreReviews}
                onClick={() => void loadMoreReviews()}
                className="mt-2 w-full border border-border px-3 py-2 text-sm font-mono text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {isLoadingMoreReviews ? "Loading older runs..." : "Load older runs"}
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel
          as="aside"
          aria-label="Review insights"
          data-pane="insights"
          data-focused={focusZone === "insights" || focusZone === "retry" || undefined}
          className="mt-3 shrink-0 flex flex-col border border-border data-[focused]:border-info focus:outline-none md:min-h-0 md:w-80"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Insights{selectedRun ? ` · ${formatRunId(selectedRun.id)}` : ""}
          </Panel.Label>
          <HistoryInsightsPane
            runId={selectedRun?.id ?? null}
            severityCounts={hasReviews ? severityCounts : null}
            issues={hasReviews ? sortedIssues : []}
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
