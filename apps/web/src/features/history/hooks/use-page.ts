import {
  buildCleanRunFactLine,
  buildCleanRunStatement,
  isCleanRun,
  useHistoryScreenState,
} from "@diffgazer/core/review";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useRef, useState } from "react";
import { useHeaderBackButtonRef } from "@/components/layout/header-chrome";
import { getRunSummary } from "@/features/history/components/run-summary";
import type { HistoryCleanRun, HistoryFocusZone, Run } from "@/features/history/types";
import {
  HISTORY_DATE_KEY,
  HISTORY_RUN_KEY,
  useScopedRouteState,
} from "@/hooks/use-scoped-route-state";

export function useHistoryPage() {
  const navigate = useNavigate();

  const history = useHistoryScreenState({
    selectedRunId: useScopedRouteState<string | null>(HISTORY_RUN_KEY, null),
    selectedDateId: useScopedRouteState<string>(HISTORY_DATE_KEY, "all"),
    searchQuery: useState(""),
  });

  const backButtonRef = useHeaderBackButtonRef();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const warningsRef = useRef<HTMLDivElement>(null);
  const listRetryRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const runsListRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const insightsListRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const zoneRefs: Record<HistoryFocusZone, RefObject<HTMLElement | null>> = {
    chrome: backButtonRef,
    warnings: warningsRef,
    "list-retry": listRetryRef,
    search: searchInputRef,
    timeline: timelineRef,
    runs: runsListRef,
    "load-more": loadMoreRef,
    insights: insightsListRef,
    retry: retryRef,
  };

  const [focusZone, setFocusZoneState] = useState<HistoryFocusZone>("runs");

  // Below md the panes stack into a scrolling column, so the pane that becomes
  // active can sit below the fold, and zone focus is applied with preventScroll.
  // Every zone change goes through here, so the scroll rides the change itself
  // instead of being re-derived from state afterwards.
  const setFocusZone = (zone: HistoryFocusZone) => {
    if (zone === focusZone) return;
    setFocusZoneState(zone);
    zoneRefs[zone].current?.scrollIntoView({ block: "nearest" });
  };

  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);
  const [prevIssueRunId, setPrevIssueRunId] = useState<string | null>(history.selectedRunId);
  if (prevIssueRunId !== history.selectedRunId) {
    setPrevIssueRunId(history.selectedRunId);
    setHighlightedIssueId(null);
  }
  const firstIssueId = history.sortedIssues[0]?.id ?? null;
  const effectiveHighlightedIssueId = history.sortedIssues.some((i) => i.id === highlightedIssueId)
    ? highlightedIssueId
    : firstIssueId;

  // The chip rendering needs the metadata the run was built from; when a run
  // outlives its entry, the run keeps the core's plain-text sentence.
  const reviewsById = new Map(history.reviews.map((review) => [review.id, review]));
  const mappedRuns: Run[] = history.mappedRuns.map((run) => {
    const metadata = reviewsById.get(run.id);
    return {
      ...run,
      summary: metadata ? getRunSummary(metadata) : run.summary,
    };
  });

  // The same predicate the row's "Passed with no issues." and the review screen
  // read, so the pane cannot disagree with either. The severity floor is not on
  // the list metadata, so the statement waits on the detail record — the only
  // place a run's hidden findings are counted. Until it lands the pane states no
  // verdict at all rather than an unqualified pass it has not checked.
  const selectedRun = history.selectedRun;
  const isSelectedRunClean =
    selectedRun !== null &&
    isCleanRun({
      issueCount: selectedRun.issueCount,
      failedLensCount: selectedRun.failedLensCount,
      salvagedLensCount: selectedRun.salvagedLensCount,
      terminalOutcome: selectedRun.terminalOutcome,
    });
  const reviewDetail = history.reviewDetail;
  const cleanRun: HistoryCleanRun | null =
    selectedRun && isSelectedRunClean && reviewDetail
      ? {
          statement: buildCleanRunStatement({
            droppedBelowThreshold: reviewDetail.droppedBelowThreshold,
            minSeverity: reviewDetail.minSeverity,
          }),
          factLine: buildCleanRunFactLine({
            fileCount: selectedRun.fileCount,
            lensCount: selectedRun.lenses.length,
            durationMs: selectedRun.durationMs,
          }),
        }
      : null;

  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      return;
    }
    setFocusZone("runs");
  };

  // SearchInput clears a non-empty filter itself and only calls this once the
  // field is empty, so this stage just leaves the search box. With no runs list
  // rendered there is nothing to leave to, so the field keeps focus.
  const handleSearchEscape = () => {
    if (mappedRuns.length === 0) return;
    searchInputRef.current?.blur();
    setFocusZone("runs");
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    setFocusZone("timeline");
  };

  const handleRunActivate = (runId: string) => {
    navigate({ to: "/review/{-$reviewId}", params: { reviewId: runId } });
  };

  const handleRunSelect = (runId: string) => {
    setFocusZone("runs");
    if (runId === history.selectedRunId) {
      handleRunActivate(runId);
      return;
    }
    history.setSelectedRunId(runId);
  };

  const handleRunsBoundary = (direction: "previous" | "next") => {
    if (direction === "previous") {
      setFocusZone("search");
      return;
    }
    if (history.hasMoreReviews) setFocusZone("load-more");
  };

  const handleIssueClick = (issueId: string) => {
    setHighlightedIssueId(issueId);
    if (history.selectedRunId) {
      navigate({
        to: "/review/{-$reviewId}",
        params: { reviewId: history.selectedRunId },
        search: { issueId },
      });
    }
  };

  return {
    reviewsQuery: history.reviewsQuery,
    reviewDetailQuery: history.reviewDetailQuery,
    runIdLookup: history.runIdLookup,
    focusZone,
    searchQuery: history.searchQuery,
    searchInputRef,
    warningsRef,
    listRetryRef,
    timelineRef,
    runsListRef,
    loadMoreRef,
    insightsListRef,
    retryRef,
    setSearchQuery: history.setSearchQuery,
    setFocusZone,
    timelineItems: history.timelineItems,
    selectedDateId: history.selectedDateId,
    setSelectedDateId: history.setSelectedDateId,
    selectedRunId: history.selectedRunId,
    setSelectedRunId: history.setSelectedRunId,
    mappedRuns,
    selectedRun: history.selectedRun,
    // A clean run has no breakdown to draw; five zero bars are not the verdict.
    severityCounts: isSelectedRunClean ? null : history.severityCounts,
    cleanRun,
    sortedIssues: history.sortedIssues,
    duration: history.duration,
    emptyRunsMessage: history.emptyRunsMessage,
    hasSearchQuery: history.hasSearchQuery,
    hasMoreReviews: history.hasMoreReviews,
    isLoadingMoreReviews: history.isLoadingMoreReviews,
    loadMoreReviews: history.loadMoreReviews,
    handleTimelineBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunSelect,
    handleRunActivate,
    handleRunsBoundary,
    handleIssueClick,
    highlightedIssueId: effectiveHighlightedIssueId,
    setHighlightedIssueId,
  };
}
