import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { HistoryFocusZone } from "@/features/history/types";
import type { Run } from "@/features/history/types";
import type { ReviewMetadata } from "@stargazer/schemas/review";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useReviews } from "@/features/history/hooks/use-reviews";
import { useReviewDetail } from "@/features/history/hooks/use-review-detail";
import { useHistoryKeyboard } from "@/features/history/hooks/use-history-keyboard";
import { HISTORY_SECTION_ALL_ID } from "@/features/history/constants";
import { getDateKey, getTimestamp, getRunSummary, buildTimelineItems, formatDuration } from "@/features/history/utils";

function useHistoryData() {
  const { reviews, isLoading, error } = useReviews();
  const [selectedRunId, setSelectedRunId] = useScopedRouteState("run", reviews[0]?.id ?? null);

  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const { review: reviewDetail } = useReviewDetail(selectedRunId);

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
    isLoading,
    error,
    reviews,
    selectedRun,
    selectedRunId,
    setSelectedRunId,
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

export function useHistoryPage() {
  const navigate = useNavigate();
  const data = useHistoryData();
  const selection = useHistorySelection(data.reviews);
  const search = useHistorySearch();
  const { mappedRuns } = useFilteredRuns(data.reviews, selection.selectedDateId, search.searchQuery);

  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");

  useHistoryKeyboard({
    focusZone,
    setFocusZone,
    selectedRunId: data.selectedRunId,
    searchInputRef: search.searchInputRef,
  });

  useEffect(() => {
    const hasSection = selection.timelineItems.some((item) => item.id === selection.selectedDateId);
    if (!hasSection && selection.timelineItems.length > 0) {
      selection.setSelectedDateId(selection.timelineItems[0]!.id);
    }
  }, [selection.selectedDateId, selection.setSelectedDateId, selection.timelineItems]);

  useEffect(() => {
    if (focusZone !== "runs") return;
    if (mappedRuns.length === 0) return;

    const hasSelectedRun = mappedRuns.some((run) => run.id === data.selectedRunId);
    if (!hasSelectedRun) {
      data.setSelectedRunId(mappedRuns[0]!.id);
    }
  }, [focusZone, mappedRuns, data.selectedRunId, data.setSelectedRunId]);

  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      search.searchInputRef.current?.focus();
      return;
    }
    setFocusZone("runs");
  };

  const handleSearchEscape = () => {
    if (search.searchQuery) {
      search.setSearchQuery("");
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
    navigate({ to: "/review/$reviewId", params: { reviewId: runId } });
  };

  const handleRunsBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      search.searchInputRef.current?.focus();
    }
  };

  const handleIssueClick = () => {
    if (data.selectedRunId) {
      navigate({ to: "/review/$reviewId", params: { reviewId: data.selectedRunId } });
    }
  };

  const hasReviews = data.reviews.length > 0;
  const hasSearchQuery = search.searchQuery.trim().length > 0;
  const emptyRunsMessage = !hasReviews
    ? "No reviews yet"
    : hasSearchQuery
      ? "No runs match this search"
      : selection.selectedDateId === HISTORY_SECTION_ALL_ID
        ? "No runs available"
        : "No runs for this date";

  return {
    isLoading: data.isLoading,
    error: data.error,
    focusZone,
    searchQuery: search.searchQuery,
    searchInputRef: search.searchInputRef,
    setSearchQuery: search.setSearchQuery,
    setFocusZone,
    timelineItems: selection.timelineItems,
    selectedDateId: selection.selectedDateId,
    setSelectedDateId: selection.setSelectedDateId,
    selectedRunId: data.selectedRunId,
    setSelectedRunId: data.setSelectedRunId,
    mappedRuns,
    selectedRun: data.selectedRun,
    severityCounts: data.severityCounts,
    sortedIssues: data.sortedIssues,
    duration: data.duration,
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
