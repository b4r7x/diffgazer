import type { useReviews } from "@diffgazer/core/api/hooks";
import { type HistoryScreenState, useHistoryScreenState } from "@diffgazer/core/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewMetadata } from "@diffgazer/core/schemas/review";
import { useState } from "react";
import { getAvailableHistoryZones, type MappedRun, nextHistoryZone } from "../lib/run-mapping";
import type { HistoryFocusZone } from "../types";

export type { MappedRun } from "../lib/run-mapping";

export interface UseHistoryScreenResult {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviews: ReviewMetadata[];

  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  cycleFocusZone: () => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

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

  handleRunActivate: (runId: string) => void;
  handleIssueClick: () => void;
}

interface UseHistoryScreenOptions {
  onOpenReview: (runId: string) => void;
}

export function useHistoryScreen({
  onOpenReview,
}: UseHistoryScreenOptions): UseHistoryScreenResult {
  const history = useHistoryScreenState();

  const [focusZone, setFocusZoneState] = useState<HistoryFocusZone>("runs");
  const availableZones = getAvailableHistoryZones({
    hasRuns: history.mappedRuns.length > 0,
    hasSelectedRun: history.selectedRunId !== null,
  });
  const fallbackFocusZone = availableZones[0] ?? "search";
  const activeFocusZone = availableZones.includes(focusZone) ? focusZone : fallbackFocusZone;

  const setFocusZone = (zone: HistoryFocusZone) => {
    setFocusZoneState(availableZones.includes(zone) ? zone : activeFocusZone);
  };

  const cycleFocusZone = () => {
    setFocusZoneState((z) => {
      const currentZone = availableZones.includes(z) ? z : fallbackFocusZone;
      return nextHistoryZone(currentZone, availableZones);
    });
  };

  const handleIssueClick = () => {
    if (history.selectedRunId) onOpenReview(history.selectedRunId);
  };

  return {
    reviewsQuery: history.reviewsQuery,
    reviews: history.reviews,
    focusZone: activeFocusZone,
    setFocusZone,
    cycleFocusZone,
    searchQuery: history.searchQuery,
    setSearchQuery: history.setSearchQuery,
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
    handleRunActivate: onOpenReview,
    handleIssueClick,
  };
}
