import { useState } from "react";
import { useReviews, useReview } from "@diffgazer/core/api/hooks";
import { formatDuration, getDateKey } from "@diffgazer/core/format";
import type { ReviewIssue, ReviewMetadata } from "@diffgazer/core/schemas/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import {
  buildTimelineItems,
  getEmptyRunsMessage,
  HISTORY_SECTION_ALL_ID,
  matchesHistoryQuery,
  resolveSelectedDateId,
  resolveSelectedRunId,
} from "@diffgazer/core/review";
import type { HistoryFocusZone } from "../types";
import {
  buildHistorySeverityCounts,
  mapHistoryRun,
  nextHistoryZone,
  sortIssuesBySeverity,
  type MappedRun,
} from "./history-screen-utils";

export type { MappedRun } from "./history-screen-utils";

export interface UseHistoryScreenResult {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviews: ReviewMetadata[];

  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  cycleFocusZone: () => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  timelineItems: ReturnType<typeof buildTimelineItems>;
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

export function useHistoryScreen({ onOpenReview }: UseHistoryScreenOptions): UseHistoryScreenResult {
  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data?.reviews ?? [];

  const [focusZone, setFocusZoneState] = useState<HistoryFocusZone>("runs");
  const [searchQuery, setSearchQueryState] = useState("");
  const [rawSelectedDateId, setSelectedDateIdState] = useState<string>(HISTORY_SECTION_ALL_ID);
  const [rawSelectedRunId, setSelectedRunIdState] = useState<string | null>(null);

  const timelineItems = buildTimelineItems(reviews);
  const selectedDateId = resolveSelectedDateId(rawSelectedDateId, timelineItems);

  const bySection =
    selectedDateId === HISTORY_SECTION_ALL_ID
      ? reviews
      : reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId);

  const query = searchQuery.trim().toLowerCase();
  const filteredReviews = !query ? bySection : bySection.filter((r) => matchesHistoryQuery(r, query));
  const mappedRuns = filteredReviews.map(mapHistoryRun);

  const selectedRunId = resolveSelectedRunId(rawSelectedRunId, mappedRuns);

  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const reviewDetailQuery = useReview(selectedRunId ?? "");
  const reviewDetail = reviewDetailQuery.data?.review ?? null;
  const sortedIssues = sortIssuesBySeverity(reviewDetail?.result?.issues);

  const severityCounts = buildHistorySeverityCounts(selectedRun);
  const duration = formatDuration(selectedRun?.durationMs);

  const hasReviews = reviews.length > 0;
  const hasSearchQuery = query.length > 0;
  const emptyRunsMessage = getEmptyRunsMessage(hasReviews, hasSearchQuery, selectedDateId);

  const resetSelectedRun = () => {
    if (rawSelectedRunId !== null) setSelectedRunIdState(null);
  };

  const setSearchQuery = (next: string) => {
    setSearchQueryState(next);
    resetSelectedRun();
  };

  const setSelectedDateId = (id: string) => {
    setSelectedDateIdState(id);
    resetSelectedRun();
  };

  const setFocusZone = (zone: HistoryFocusZone) => {
    setFocusZoneState(zone);
  };

  const cycleFocusZone = () => {
    setFocusZoneState((z) => nextHistoryZone(z));
  };

  const handleIssueClick = () => {
    if (selectedRunId) onOpenReview(selectedRunId);
  };

  return {
    reviewsQuery,
    reviews,
    focusZone,
    setFocusZone,
    cycleFocusZone,
    searchQuery,
    setSearchQuery,
    timelineItems,
    selectedDateId,
    setSelectedDateId,
    mappedRuns,
    selectedRunId,
    setSelectedRunId: setSelectedRunIdState,
    selectedRun,
    severityCounts,
    sortedIssues,
    duration,
    hasReviews,
    emptyRunsMessage,
    handleRunActivate: onOpenReview,
    handleIssueClick,
  };
}
