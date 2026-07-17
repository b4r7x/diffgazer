import type { useReviews } from "@diffgazer/core/api/hooks";
import {
  filterReviewsForHistory,
  type HistoryScreenState,
  useHistoryScreenState,
} from "@diffgazer/core/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewMetadata } from "@diffgazer/core/schemas/review";
import { useState } from "react";
import {
  getAvailableHistoryZones,
  type HistoryInteractionMode,
  type MappedRun,
  nextHistoryZone,
} from "../lib/run-mapping";
import type { HistoryFocusZone } from "../types";

export type { MappedRun } from "../lib/run-mapping";

export interface UseHistoryScreenResult {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviewDetailQuery: HistoryScreenState["reviewDetailQuery"];
  reviews: ReviewMetadata[];

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

  mappedRuns: MappedRun[];
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
  handleOpenReview: () => void;
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
    !history.reviewsQuery.error &&
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

  const handleOpenReview = () => {
    if (history.selectedRunId) onOpenReview(history.selectedRunId);
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
    handleOpenReview,
  };
}
