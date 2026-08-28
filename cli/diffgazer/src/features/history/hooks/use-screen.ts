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
import type { HistoryFocusZone, HistoryInteractionMode, HistoryRunsSubZone } from "../types";

export interface UseHistoryScreenResult {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviewDetailQuery: HistoryScreenState["reviewDetailQuery"];
  reviews: ReviewMetadata[];
  runIdLookup: RunIdLookup;
  retainedError: HistoryScreenState["retainedError"];

  focusZone: HistoryFocusZone;
  availableZones: HistoryFocusZone[];
  interactionMode: HistoryInteractionMode;
  setFocusZone: (zone: HistoryFocusZone) => void;
  cycleFocusZone: () => void;
  runsSubZone: HistoryRunsSubZone;
  setRunsSubZone: (zone: HistoryRunsSubZone) => void;

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
  reviewDetail: HistoryScreenState["reviewDetail"];
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
  const [runsSubZone, setRunsSubZoneState] = useState<HistoryRunsSubZone>("list");
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
  const activeRunsSubZone: HistoryRunsSubZone =
    activeFocusZone === "runs" && (history.hasMoreReviews || history.isLoadingMoreReviews)
      ? runsSubZone
      : "list";
  let interactionMode: HistoryInteractionMode = "route";
  if (rendersHistoryControls) {
    interactionMode = activeRunsSubZone === "load-more" ? "load-more" : activeFocusZone;
  }

  const setFocusZone = (zone: HistoryFocusZone) => {
    setRunsSubZoneState("list");
    setFocusZoneState(availableZones.includes(zone) ? zone : activeFocusZone);
  };

  const cycleFocusZone = () => {
    setRunsSubZoneState("list");
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
    availableZones,
    interactionMode,
    setFocusZone,
    cycleFocusZone,
    runsSubZone: activeRunsSubZone,
    setRunsSubZone: setRunsSubZoneState,
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
    reviewDetail: history.reviewDetail,
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
