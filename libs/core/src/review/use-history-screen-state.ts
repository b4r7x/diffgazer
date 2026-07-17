import { type Dispatch, type SetStateAction, useState } from "react";
import { useReview, useReviews } from "../api/hooks/review.js";
import { formatDuration } from "../format.js";
import type { SeverityCounts, TimelineItem } from "../schemas/presentation/index.js";
import type { ReviewIssue, ReviewMetadata } from "../schemas/review/index.js";
import {
  buildHistoryRunSummary,
  buildTimelineItems,
  filterReviewsForHistory,
  getEmptyRunsMessage,
  HISTORY_SECTION_ALL_ID,
  type HistoryRunSummary,
  metadataToSeverityCounts,
  resolveSelectedDateId,
  resolveSelectedId,
  sortIssuesBySeverity,
} from "./history.js";

/** A `[value, setter]` pair, mirroring `useState`'s return shape. */
type StatePair<T> = [T, Dispatch<SetStateAction<T>>];

export interface UseHistoryScreenStateOptions {
  /** Surface-owned selection state; defaults to internal `useState`. */
  selectedRunId?: StatePair<string | null>;
  selectedDateId?: StatePair<string>;
  searchQuery?: StatePair<string>;
}

export interface HistoryScreenState {
  reviewsQuery: ReturnType<typeof useReviews>;
  reviewDetailQuery: ReturnType<typeof useReview>;
  reviews: ReviewMetadata[];
  isLoading: boolean;
  error: string | null;

  timelineItems: TimelineItem[];
  selectedDateId: string;
  setSelectedDateId: (id: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  mappedRuns: HistoryRunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: Dispatch<SetStateAction<string | null>>;

  selectedRun: ReviewMetadata | null;
  severityCounts: SeverityCounts | null;
  sortedIssues: ReviewIssue[];
  duration: string;

  hasReviews: boolean;
  hasSearchQuery: boolean;
  emptyRunsMessage: string;
  hasMoreReviews: boolean;
  isLoadingMoreReviews: boolean;
  loadMoreReviews: () => Promise<void>;
}

/**
 * Owns the history screen pipeline shared by both surfaces — reviews →
 * timeline → date-resolve → filter → run-resolve → detail → counts/duration/
 * empty-message — plus the reset-selected-run-on-filter-change contract.
 * Surfaces pass their own selection state via adapter pairs (web persists via
 * scoped route state, the TUI via `useState`) and keep navigation/focus local.
 */
export function useHistoryScreenState(
  options: UseHistoryScreenStateOptions = {},
): HistoryScreenState {
  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data?.reviews ?? [];

  const internalRunId = useState<string | null>(null);
  const internalDateId = useState<string>(HISTORY_SECTION_ALL_ID);
  const internalSearch = useState("");

  const [rawSelectedRunId, setRawSelectedRunId] = options.selectedRunId ?? internalRunId;
  const [rawSelectedDateId, setRawSelectedDateId] = options.selectedDateId ?? internalDateId;
  const [searchQuery, setRawSearchQuery] = options.searchQuery ?? internalSearch;

  const timelineItems = buildTimelineItems(reviews);
  const selectedDateId = resolveSelectedDateId(rawSelectedDateId, timelineItems);

  const filteredReviews = filterReviewsForHistory(reviews, selectedDateId, searchQuery);
  const peerRunIds = reviews.map((review) => review.id);
  const mappedRuns = filteredReviews.map((review) => buildHistoryRunSummary(review, peerRunIds));
  const selectedRunId = resolveSelectedId(rawSelectedRunId, mappedRuns);
  const selectedRun = reviews.find((review) => review.id === selectedRunId) ?? null;

  const reviewDetailQuery = useReview(selectedRunId ?? "");
  const reviewDetail = reviewDetailQuery.data?.review ?? null;
  const sortedIssues = sortIssuesBySeverity(reviewDetail?.result?.issues);

  const severityCounts = metadataToSeverityCounts(selectedRun);
  const duration = formatDuration(selectedRun?.durationMs);

  const hasReviews = reviews.length > 0;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const emptyRunsMessage = getEmptyRunsMessage(hasReviews, hasSearchQuery, selectedDateId);
  const loadMoreReviews = async () => {
    await reviewsQuery.fetchNextPage();
  };

  const resetSelectedRun = () => {
    if (rawSelectedRunId !== null) setRawSelectedRunId(null);
  };

  const setSearchQuery = (query: string) => {
    setRawSearchQuery(query);
    resetSelectedRun();
  };

  const setSelectedDateId = (id: string) => {
    setRawSelectedDateId(id);
    resetSelectedRun();
  };

  return {
    reviewsQuery,
    reviewDetailQuery,
    reviews,
    isLoading: reviewsQuery.isLoading,
    error: reviewsQuery.error?.message ?? null,
    timelineItems,
    selectedDateId,
    setSelectedDateId,
    searchQuery,
    setSearchQuery,
    mappedRuns,
    selectedRunId,
    setSelectedRunId: setRawSelectedRunId,
    selectedRun,
    severityCounts,
    sortedIssues,
    duration,
    hasReviews,
    hasSearchQuery,
    emptyRunsMessage,
    hasMoreReviews: reviewsQuery.hasNextPage,
    isLoadingMoreReviews: reviewsQuery.isFetchingNextPage,
    loadMoreReviews,
  };
}
