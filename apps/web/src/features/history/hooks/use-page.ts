import { useHistoryScreenState } from "@diffgazer/core/review";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useRef, useState } from "react";
import { getRunSummary } from "@/features/history/components/run-summary";
import type { HistoryFocusZone, Run } from "@/features/history/types";
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const runsListRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const insightsListRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const zoneRefs: Record<HistoryFocusZone, RefObject<HTMLElement | null>> = {
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

  const reviewsById = new Map(history.reviews.map((review) => [review.id, review]));
  const mappedRuns: Run[] = history.mappedRuns.map((run) => {
    const metadata = reviewsById.get(run.id);
    return {
      ...run,
      summary: metadata ? getRunSummary(metadata) : null,
    };
  });

  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      return;
    }
    setFocusZone("runs");
  };

  // Two-stage, matching the footer's "Esc Clear Search" promise: the first Escape
  // clears a non-empty filter in place, the second leaves the search box.
  const handleSearchEscape = () => {
    if (history.searchQuery) {
      history.setSearchQuery("");
      return;
    }
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

  const handleRunsBoundary = () => {
    setFocusZone("search");
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
    focusZone,
    searchQuery: history.searchQuery,
    searchInputRef,
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
    severityCounts: history.severityCounts,
    sortedIssues: history.sortedIssues,
    duration: history.duration,
    hasReviews: history.hasReviews,
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
