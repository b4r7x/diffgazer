import type { useReviews } from "@diffgazer/core/api/hooks";
import type { RunIdLookup } from "@diffgazer/core/format";
import {
  filterReviewsForHistory,
  type HistoryRunSummary,
  type HistoryScreenState,
  useHistoryScreenState,
} from "@diffgazer/core/review";
import type { ReviewIssue, ReviewMetadata, SeverityCounts } from "@diffgazer/core/schemas/review";
import { useState } from "react";
import { getAvailableHistoryZones, nextHistoryZone } from "../lib/focus-zones";
import type { HistoryFocusZone, HistoryInteractionMode } from "../types";

export interface UseHistoryScreenResult {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviewDetailQuery: HistoryScreenState["reviewDetailQuery"];
  reviews: ReviewMetadata[];
  runIdLookup: RunIdLookup;
  retainedError: HistoryScreenState["retainedError"];

  focusZone: HistoryFocusZone;
  interactionMode: HistoryInteractionMode;
  setFocusZone: (zone: HistoryFocusZone) => void;
  cycleFocusZone: () => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearchAndFocusRuns: () => void;

  timelineItems: HistoryScreenState["timelineItems"];
  selectedDateId: string;
  setSelectedDateId: (id: string) => void;

  mappedRuns: HistoryRunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;

  selectedRun: ReviewMetadata | null;
  severityCounts: SeverityCounts | null;
  sortedIssues: ReviewIssue[];
  duration: string;
  hasReviews: boolean;
  emptyRunsMessage: string;
  hasMoreReviews: boolean;
  isLoadingMoreReviews: boolean;
  loadMoreReviews: () => Promise<void>;

  handleRunActivate: (runId: string) => void;
}

interface UseHistoryScreenOptions {
  onOpenReview: (runId: string) => void;
}

export function useHistoryScreen({
  onOpenReview,
}: UseHistoryScreenOptions): UseHistoryScreenResult {
  const history = useHistoryScreenState();

  const [focusZone, setFocusZoneState] = useState<HistoryFocusZone>("runs");
  const hasNavigableRuns = history.mappedRuns.length > 0 || history.hasMoreReviews;
  const availableZones = getAvailableHistoryZones({
    hasRuns: hasNavigableRuns,
    hasSelectedRun: history.selectedRunId !== null,
  });
  const fallbackFocusZone = availableZones[0] ?? "search";
  const activeFocusZone = availableZones.includes(focusZone) ? focusZone : fallbackFocusZone;
  const rendersHistoryControls =
    !history.reviewsQuery.isLoading &&
    history.reviewsQuery.data !== undefined &&
    (history.hasReviews || history.hasMoreReviews);
  const interactionMode: HistoryInteractionMode = rendersHistoryControls
    ? activeFocusZone
    : "route";

  const setFocusZone = (zone: HistoryFocusZone) => {
    setFocusZoneState(availableZones.includes(zone) ? zone : activeFocusZone);
  };

  const cycleFocusZone = () => {
    setFocusZoneState((z) => {
      const currentZone = availableZones.includes(z) ? z : fallbackFocusZone;
      return nextHistoryZone(currentZone, availableZones);
    });
  };

  const clearSearchAndFocusRuns = () => {
    const firstRunId =
      filterReviewsForHistory(history.reviews, history.selectedDateId, "")[0]?.id ?? null;
    history.setSearchQuery("");
    if (firstRunId === null) return;
    history.setSelectedRunId(firstRunId);
    setFocusZoneState("runs");
  };

  return {
    reviewsQuery: history.reviewsQuery,
    reviewDetailQuery: history.reviewDetailQuery,
    reviews: history.reviews,
    runIdLookup: history.runIdLookup,
    retainedError: history.retainedError,
    focusZone: activeFocusZone,
    interactionMode,
    setFocusZone,
    cycleFocusZone,
    searchQuery: history.searchQuery,
    setSearchQuery: history.setSearchQuery,
    clearSearchAndFocusRuns,
    timelineItems: history.timelineItems,
    selectedDateId: history.selectedDateId,
    setSelectedDateId: history.setSelectedDateId,
    mappedRuns: history.mappedRuns,
    selectedRunId: history.selectedRunId,
    setSelectedRunId: history.setSelectedRunId,
    selectedRun: history.selectedRun,
    severityCounts: history.severityCounts,
    sortedIssues: history.sortedIssues,
    duration: history.duration,
    hasReviews: history.hasReviews,
    emptyRunsMessage: history.emptyRunsMessage,
    hasMoreReviews: history.hasMoreReviews,
    isLoadingMoreReviews: history.isLoadingMoreReviews,
    loadMoreReviews: history.loadMoreReviews,
    handleRunActivate: onOpenReview,
  };
}
