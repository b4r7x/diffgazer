import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { useReview, useReviews } from "../api/hooks/review.js";
import { buildRunIdLookup, formatDuration, type RunIdLookup } from "../format.js";
import type { TimelineItem } from "../schemas/presentation/index.js";
import type {
  ReviewIssue,
  ReviewListWarning,
  ReviewMetadata,
  SavedReview,
  SeverityCounts,
} from "../schemas/review/index.js";
import { sortIssuesBySeverity } from "./history/issue-order.js";
import {
  buildTimelineItems,
  filterReviewsForHistory,
  getEmptyRunsMessage,
  HISTORY_SECTION_ALL_ID,
  resolveSelectedDateId,
  resolveSelectedId,
} from "./history/navigation.js";
import {
  buildHistoryRunSummary,
  type HistoryRunSummary,
  metadataToSeverityCounts,
} from "./history/run-presentation.js";

/** A `[value, setter]` pair, mirroring `useState`'s return shape. */
type StatePair<T> = [T, Dispatch<SetStateAction<T>>];

// Shared so a not-yet-loaded query keeps the same `reviews` identity across
// renders and the derived run-label memos below survive unrelated re-renders.
// Frozen because that identity is handed to every consumer: one `sort` or
// `push` on it would reorder or fill the "empty" list for every other mount.
const NO_REVIEWS = Object.freeze<ReviewMetadata[]>([]) as ReviewMetadata[];
const NO_WARNINGS = Object.freeze<ReviewListWarning[]>([]) as ReviewListWarning[];

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
  runIdLookup: RunIdLookup;
  retainedError:
    | { kind: "pagination"; message: string }
    | { kind: "refetch"; message: string }
    | null;

  timelineItems: TimelineItem[];
  selectedDateId: string;
  setSelectedDateId: (id: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  mappedRuns: HistoryRunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: Dispatch<SetStateAction<string | null>>;

  selectedRun: ReviewMetadata | null;
  /**
   * The selected run's saved record, once the detail query resolves. The list
   * metadata does not persist the severity floor a run was filtered against, so
   * this is where a pane reads what the run hid.
   */
  reviewDetail: SavedReview | null;
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
  const reviews = reviewsQuery.data?.reviews ?? NO_REVIEWS;
  const warnings = reviewsQuery.data?.warnings ?? NO_WARNINGS;

  const internalRunId = useState<string | null>(null);
  const internalDateId = useState<string>(HISTORY_SECTION_ALL_ID);
  const internalSearch = useState("");

  const [rawSelectedRunId, setRawSelectedRunId] = options.selectedRunId ?? internalRunId;
  const [rawSelectedDateId, setRawSelectedDateId] = options.selectedDateId ?? internalDateId;
  const [searchQuery, setRawSearchQuery] = options.searchQuery ?? internalSearch;

  const timelineItems = buildTimelineItems(reviews);
  const selectedDateId = resolveSelectedDateId(rawSelectedDateId, timelineItems);

  const runIdLookup = useMemo(() => {
    const ids = new Set(reviews.map((review) => review.id));
    for (const warning of warnings) {
      if ("reviewId" in warning) ids.add(warning.reviewId);
    }
    return buildRunIdLookup([...ids]);
  }, [reviews, warnings]);
  const filteredReviews = useMemo(
    () => filterReviewsForHistory(reviews, selectedDateId, searchQuery, runIdLookup),
    [reviews, selectedDateId, searchQuery, runIdLookup],
  );
  const mappedRuns = useMemo(
    () => filteredReviews.map((review) => buildHistoryRunSummary(review, runIdLookup)),
    [filteredReviews, runIdLookup],
  );
  const selectedRunId = resolveSelectedId(rawSelectedRunId, mappedRuns);
  const selectedRun = reviews.find((review) => review.id === selectedRunId) ?? null;

  const reviewDetailQuery = useReview(selectedRunId);
  const reviewDetail = reviewDetailQuery.data?.review ?? null;
  const sortedIssues = sortIssuesBySeverity(reviewDetail?.result?.issues);

  const severityCounts = metadataToSeverityCounts(selectedRun);
  const duration = formatDuration(selectedRun?.durationMs);

  const hasReviews = reviews.length > 0;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const emptyRunsMessage = getEmptyRunsMessage(hasReviews, hasSearchQuery, selectedDateId);
  const hasLoadedReviews = reviewsQuery.data !== undefined;
  const queryError = reviewsQuery.error?.message ?? null;
  const retainedError: HistoryScreenState["retainedError"] =
    hasLoadedReviews && queryError !== null
      ? {
          kind: reviewsQuery.isFetchNextPageError ? "pagination" : "refetch",
          message: queryError,
        }
      : null;
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
    runIdLookup,
    retainedError,
    timelineItems,
    selectedDateId,
    setSelectedDateId,
    searchQuery,
    setSearchQuery,
    mappedRuns,
    selectedRunId,
    setSelectedRunId: setRawSelectedRunId,
    selectedRun,
    reviewDetail,
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
