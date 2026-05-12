import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { HistoryFocusZone } from "@/features/history/types";
import type { Run } from "@/features/history/types";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useReviews, useReview } from "@diffgazer/core/api/hooks";
import { HISTORY_SECTION_ALL_ID } from "@/features/history/constants";
import { getDateKey, getTimestamp, formatDuration } from "@diffgazer/core/format";
import { getRunSummary, buildTimelineItems } from "@/features/history/utils";

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

export function resolveSelectedDateId(selectedDateId: string, timelineItems: Array<{ id: string }>): string {
  if (timelineItems.some((item) => item.id === selectedDateId)) return selectedDateId;
  return timelineItems[0]?.id ?? HISTORY_SECTION_ALL_ID;
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
  const filteredRuns = !query ? bySection : bySection.filter((r) => {
    if (r.id.toLowerCase().includes(query)) return true;
    if (`#${r.id.slice(0, 4)}`.toLowerCase().includes(query)) return true;
    const branchText = r.mode === "staged" ? "staged" : (r.branch?.toLowerCase() ?? "main");
    if (branchText.includes(query)) return true;
    if (r.projectPath.toLowerCase().includes(query)) return true;
    return false;
  });

  const mappedRuns: Run[] = filteredRuns.map((run) => ({
    id: run.id,
    displayId: `#${run.id.slice(0, 4)}`,
    branch: run.mode === "staged" ? "Staged" : run.branch ?? "Main",
    provider: "AI",
    timestamp: getTimestamp(run.createdAt),
    summary: getRunSummary(run),
    issues: [],
  }));

  return { mappedRuns };
}

export function resolveSelectedRunId(selectedRunId: string | null, mappedRuns: Run[]): string | null {
  if (mappedRuns.some((run) => run.id === selectedRunId)) return selectedRunId;
  return mappedRuns[0]?.id ?? null;
}

function getEmptyRunsMessage(hasReviews: boolean, hasSearchQuery: boolean, selectedDateId: string): string {
  if (!hasReviews) return "No reviews yet";
  if (hasSearchQuery) return "No runs match this search";
  if (selectedDateId === HISTORY_SECTION_ALL_ID) return "No runs available";
  return "No runs for this date";
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
