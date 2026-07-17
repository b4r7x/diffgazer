import { useHistoryScreenState } from "@diffgazer/core/review";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { getRunSummary } from "@/features/history/components/run-summary";
import type { HistoryFocusZone, Run } from "@/features/history/types";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";

export function useHistoryPage() {
  const navigate = useNavigate();

  const history = useHistoryScreenState({
    selectedRunId: useScopedRouteState<string | null>("run", null),
    selectedDateId: useScopedRouteState<string>("date", "all"),
    searchQuery: useState(""),
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");

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

  const handleSearchEscape = () => {
    if (history.searchQuery) {
      history.setSearchQuery("");
    } else {
      searchInputRef.current?.blur();
      setFocusZone("runs");
    }
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    setFocusZone("timeline");
  };

  const handleRunActivate = (runId: string) => {
    navigate({ to: "/review/{-$reviewId}", params: { reviewId: runId } });
  };

  const handleRunsBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
    }
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
    hasMoreReviews: history.hasMoreReviews,
    isLoadingMoreReviews: history.isLoadingMoreReviews,
    loadMoreReviews: history.loadMoreReviews,
    handleTimelineBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunActivate,
    handleRunsBoundary,
    handleIssueClick,
    highlightedIssueId: effectiveHighlightedIssueId,
    setHighlightedIssueId,
  };
}
