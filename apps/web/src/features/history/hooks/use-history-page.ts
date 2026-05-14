import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { HistoryFocusZone, Run } from "@/features/history/types";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useReviews, useReview } from "@diffgazer/core/api/hooks";
import { formatDuration, getDateKey, getTimestamp } from "@diffgazer/core/format";
import {
  buildTimelineItems,
  getEmptyRunsMessage,
  getRunBranchLabel,
  getRunDisplayId,
  HISTORY_SECTION_ALL_ID,
  matchesHistoryQuery,
  resolveSelectedDateId,
  resolveSelectedRunId,
} from "@diffgazer/core/review";
import { getRunSummary } from "@/features/history/utils";

function useHistoryData() {
  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data?.reviews ?? [];
  const isLoading = reviewsQuery.isLoading;
  const error = reviewsQuery.error?.message ?? null;
  const [selectedRunId, setSelectedRunId] = useScopedRouteState<string | null>("run", reviews[0]?.id ?? null);

  return {
    reviewsQuery,
    isLoading,
    error,
    reviews,
    selectedRunId,
    setSelectedRunId,
  };
}

function useSelectedRunData(reviews: ReviewMetadata[], selectedRunId: string | null) {
  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const reviewDetailQuery = useReview(selectedRunId ?? "");
  const reviewDetail = reviewDetailQuery.data?.review ?? null;

  const severityCounts = selectedRun
    ? {
        blocker: selectedRun.blockerCount,
        high: selectedRun.highCount,
        medium: selectedRun.mediumCount,
        low: selectedRun.lowCount,
        nit: selectedRun.nitCount,
      }
    : null;

  const duration = formatDuration(selectedRun?.durationMs);

  const issues = reviewDetail?.result?.issues;
  const sortedIssues = issues
    ? [...issues].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    : [];

  return {
    selectedRun,
    severityCounts,
    sortedIssues,
    duration,
  };
}

function useHistorySelection(reviews: ReviewMetadata[]) {
  const timelineItems = buildTimelineItems(reviews);
  const defaultDateId = timelineItems[0]?.id ?? HISTORY_SECTION_ALL_ID;
  const [selectedDateId, setSelectedDateId] = useScopedRouteState("date", defaultDateId);
  return { selectedDateId, setSelectedDateId, timelineItems };
}

function useHistorySearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  return { searchQuery, setSearchQuery, searchInputRef };
}

function useFilteredRuns(reviews: ReviewMetadata[], selectedDateId: string, searchQuery: string) {
  const bySection = selectedDateId === HISTORY_SECTION_ALL_ID
    ? reviews
    : reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId);
  const query = searchQuery.trim().toLowerCase();
  const filteredRuns = !query ? bySection : bySection.filter((r) => matchesHistoryQuery(r, query));

  const mappedRuns: Run[] = filteredRuns.map((run) => ({
    id: run.id,
    displayId: getRunDisplayId(run),
    branch: getRunBranchLabel(run),
    provider: "AI",
    timestamp: getTimestamp(run.createdAt),
    summary: getRunSummary(run),
    issues: [],
  }));

  return { mappedRuns };
}

export function useHistoryPage() {
  const navigate = useNavigate();
  const data = useHistoryData();
  const selection = useHistorySelection(data.reviews);
  const search = useHistorySearch();
  const selectedDateId = resolveSelectedDateId(selection.selectedDateId, selection.timelineItems);
  const { mappedRuns } = useFilteredRuns(data.reviews, selectedDateId, search.searchQuery);
  const selectedRunId = resolveSelectedRunId(data.selectedRunId, mappedRuns);
  const selectedRunData = useSelectedRunData(data.reviews, selectedRunId);

  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");

  const resetSelectedRun = () => {
    if (data.selectedRunId !== null) data.setSelectedRunId(null);
  };

  const setSearchQuery = (query: string) => {
    search.setSearchQuery(query);
    resetSelectedRun();
  };

  const setSelectedDateId = (id: string) => {
    selection.setSelectedDateId(id);
    resetSelectedRun();
  };

  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      return;
    }
    setFocusZone("runs");
  };

  const handleSearchEscape = () => {
    if (search.searchQuery) {
      setSearchQuery("");
    } else {
      search.searchInputRef.current?.blur();
      setFocusZone("runs");
    }
  };

  const handleSearchArrowDown = () => {
    search.searchInputRef.current?.blur();
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

  const handleIssueClick = () => {
    if (selectedRunId) {
      navigate({ to: "/review/{-$reviewId}", params: { reviewId: selectedRunId } });
    }
  };

  const hasReviews = data.reviews.length > 0;
  const hasSearchQuery = search.searchQuery.trim().length > 0;
  const emptyRunsMessage = getEmptyRunsMessage(hasReviews, hasSearchQuery, selectedDateId);

  return {
    reviewsQuery: data.reviewsQuery,
    isLoading: data.isLoading,
    error: data.error,
    focusZone,
    searchQuery: search.searchQuery,
    searchInputRef: search.searchInputRef,
    setSearchQuery,
    setFocusZone,
    timelineItems: selection.timelineItems,
    selectedDateId,
    setSelectedDateId,
    selectedRunId,
    setSelectedRunId: data.setSelectedRunId,
    mappedRuns,
    selectedRun: selectedRunData.selectedRun,
    severityCounts: selectedRunData.severityCounts,
    sortedIssues: selectedRunData.sortedIssues,
    duration: selectedRunData.duration,
    hasReviews,
    emptyRunsMessage,
    handleTimelineBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunActivate,
    handleRunsBoundary,
    handleIssueClick,
  };
}
