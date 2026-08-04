import { matchQueryState } from "@diffgazer/core/api/hooks";
import { formatRunId } from "@diffgazer/core/format";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import {
  buildHistoryWarningMessages,
  deriveHistoryDetailState,
  HISTORY_SEARCH_PLACEHOLDER,
  summarizeHistoryWarnings,
} from "@diffgazer/core/review";
import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { isListNavigationKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { useNavigate } from "@tanstack/react-router";
import type { KeyboardEvent } from "react";
import { CenteredStatus } from "@/components/shared/centered-status";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { FailureView } from "@/components/shared/failure-view";
import { TrustPanel } from "@/components/shared/trust-panel";
import { HistoryInsightsPane } from "@/features/history/components/insights-pane";
import { TimelineList } from "@/features/history/components/timeline-list";
import { useHistoryKeyboard } from "@/features/history/hooks/use-keyboard";
import { useHistoryPage } from "@/features/history/hooks/use-page";
import { useConfigData } from "@/hooks/use-config";
import { useFocusWithin } from "@/hooks/use-focus-within";

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
    sortedIssues,
    duration,
    hasReviews,
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

  const insightsDetailState = deriveHistoryDetailState({
    isLoading: reviewDetailQuery.isLoading,
    error: reviewDetailQuery.error,
    refetch: reviewDetailQuery.refetch,
  });

  useHistoryKeyboard({
    enabled: reviewsQuery.isSuccess,
    focusZone,
    setFocusZone,
    activeRunId: selectedRunId,
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

  // Pane chrome follows real DOM focus, not the keyboard zone: the zone is
  // already "runs" before anything is focused, so pinning it would bracket a
  // pane nobody is driving.
  const timelineFocus = useFocusWithin<HTMLElement>();
  const runsFocus = useFocusWithin<HTMLElement>();
  const insightsFocus = useFocusWithin<HTMLElement>();

  const handleRunsKeyDown = (event: KeyboardEvent) => {
    if (focusZone !== "runs") {
      if (isListNavigationKey(event.key)) event.preventDefault();
      return;
    }

    if (event.key === " " && selectedRunId) {
      event.preventDefault();
      handleRunActivate(selectedRunId);
    }
  };

  const guard = matchQueryState(reviewsQuery, {
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

  if (guard) return guard;

  const warnings = reviewsQuery.data?.warnings ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pt-2 pb-2">
      <HistoryWarnings warnings={warnings} />

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
          <ScrollArea className="max-h-40 pl-[2px] pt-3 pb-2 lg:max-h-none lg:min-h-0 lg:flex-1">
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
          {/* Ordering is fixed, so this reads as a datum rather than borrowing the
              bracketed-control vocabulary of the real actions on the page. */}
          <div className="flex justify-end px-3 pt-2 pb-1">
            <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
              Newest first
            </span>
          </div>
          {/* Full-bleed like SECTIONS: the highlighted row fill and every
              border-b rule span border-to-border, TUI-style. */}
          <ScrollArea className="pl-[2px] pt-1 pb-2 md:min-h-0 md:flex-1">
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
                  if (direction === "previous") handleRunsBoundary();
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
                    {/* flex-wrap plus the summary's min-w-full stack the branch
                        chip and summary on their own lines, so a run reads as
                        three lines and the list fills the pane. The indent (glyph
                        advance 1ch + its mr-2) left-aligns rows 2-3 with the
                        run-id text above. */}
                    <NavigationList.Meta className="min-w-0 flex-wrap pl-[calc(1ch+0.5rem)]">
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
            {/* The list ends well above the pane floor on a short history; the
                marker names that void as the end of the runs rather than
                inflating the cards to fill it. */}
            {mappedRuns.length > 0 ? (
              <p className="mt-6 text-center text-2xs text-muted-foreground">
                ── {pluralize(mappedRuns.length, "run")} ──
              </p>
            ) : null}
            {/* Live region stays mounted across the runs→empty transition so the
                empty message is announced; empty (and collapsed) while runs exist. */}
            <EmptyState
              variant="inline"
              size="sm"
              live
              className={mappedRuns.length === 0 ? "h-full flex-col gap-1" : "p-0"}
            >
              {mappedRuns.length === 0 ? (
                <EmptyState.Message>{emptyRunsMessage}</EmptyState.Message>
              ) : null}
              {/* Only a search has a key to press: the "no runs yet" and
                  date-filtered empties stay honest with no hint. Hidden below sm
                  because a phone has no Esc — mobile clears with the input. */}
              {mappedRuns.length === 0 && hasSearchQuery ? (
                <EmptyState.Hint className="max-sm:hidden">
                  <Kbd size="sm">Esc</Kbd> clear search
                </EmptyState.Hint>
              ) : null}
            </EmptyState>
            {hasMoreReviews ? (
              // The list is full-bleed, so the button re-insets itself: a
              // border-to-border control would read as another run row.
              <div className="px-2 pt-2">
                <Button
                  ref={loadMoreRef}
                  variant="outline"
                  size="sm"
                  bracket
                  loading={isLoadingMoreReviews}
                  onClick={() => void loadMoreReviews()}
                  className="w-full"
                >
                  Load older runs
                </Button>
              </div>
            ) : null}
          </ScrollArea>
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
            {selectedRun ? (
              <span className="normal-case"> · {formatRunId(selectedRun.id)}</span>
            ) : null}
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
