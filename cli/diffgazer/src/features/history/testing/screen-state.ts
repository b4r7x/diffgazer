import type { HistoryRunSummary } from "@diffgazer/core/review";
import type { SeverityCounts, TimelineItem } from "@diffgazer/core/schemas/presentation";
import type {
  ReviewIssue,
  ReviewListWarning,
  ReviewMetadata,
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
  return {
    reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
    reviewDetailQuery: { isLoading: false, isError: false, error: null, refetch: vi.fn() },
    reviews: [],
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
}
