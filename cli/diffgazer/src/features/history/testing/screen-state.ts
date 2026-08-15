import { buildRunIdLookup, type RunIdLookup } from "@diffgazer/core/format";
import type { HistoryRunSummary } from "@diffgazer/core/review";
import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import type {
  ReviewIssue,
  ReviewListWarning,
  ReviewMetadata,
  SeverityCounts,
} from "@diffgazer/core/schemas/review";
import { type Mock, vi } from "vitest";

interface HistoryReviewsQueryMock {
  data?: { reviews: { id: string }[]; warnings?: ReviewListWarning[] };
  isLoading: boolean;
  error: Error | null;
}

export interface HistoryScreenStateMock {
  reviewsQuery: HistoryReviewsQueryMock;
  reviewDetailQuery: { isLoading: boolean; isError: boolean; error: Error | null; refetch: Mock };
  reviews: { id: string }[];
  runIdLookup: RunIdLookup;
  timelineItems: TimelineItem[];
  selectedDateId: string;
  setSelectedDateId: Mock;
  searchQuery: string;
  setSearchQuery: Mock;
  mappedRuns: HistoryRunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: Mock;
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

export function makeHistoryScreenState(
  overrides: Partial<HistoryScreenStateMock> = {},
): HistoryScreenStateMock {
  const state: HistoryScreenStateMock = {
    reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
    reviewDetailQuery: { isLoading: false, isError: false, error: null, refetch: vi.fn() },
    reviews: [],
    runIdLookup: buildRunIdLookup([]),
    timelineItems: [],
    selectedDateId: "all",
    setSelectedDateId: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    mappedRuns: [],
    selectedRunId: null,
    setSelectedRunId: vi.fn(),
    selectedRun: null,
    severityCounts: null,
    sortedIssues: [],
    duration: "",
    hasReviews: false,
    hasSearchQuery: false,
    emptyRunsMessage: "No runs yet",
    hasMoreReviews: false,
    isLoadingMoreReviews: false,
    loadMoreReviews: vi.fn(),
    ...overrides,
  };

  if (!overrides.runIdLookup) {
    const ids = new Set(state.reviews.map((review) => review.id));
    for (const run of state.mappedRuns) ids.add(run.id);
    for (const review of state.reviewsQuery.data?.reviews ?? []) ids.add(review.id);
    for (const warning of state.reviewsQuery.data?.warnings ?? []) {
      if ("reviewId" in warning) ids.add(warning.reviewId);
    }
    state.runIdLookup = buildRunIdLookup([...ids]);
  }

  return state;
}
