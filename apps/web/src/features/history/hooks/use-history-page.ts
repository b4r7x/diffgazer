import { useState, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { HistoryFocusZone } from "@/features/history/types";
import type { Run } from "@/features/history/types";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useReviews } from "@/features/history/hooks/use-reviews";
import { useReviewDetail } from "@/features/history/hooks/use-review-detail";
import { useHistoryKeyboard } from "@/features/history/hooks/use-history-keyboard";
import { getDateKey, getTimestamp, getRunSummary, buildTimelineItems, formatDuration } from "@/features/history/utils";

export function useHistoryPage() {
  const navigate = useNavigate();
  const { reviews, isLoading, error } = useReviews();
  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const timelineItems = useMemo(() => buildTimelineItems(reviews), [reviews]);

  const defaultDateId = timelineItems[0]?.id ?? "";
  const [selectedDateId, setSelectedDateId] = useScopedRouteState("date", defaultDateId);
  const [selectedRunId, setSelectedRunId] = useScopedRouteState("run", reviews[0]?.id ?? null);

  const filteredRuns = useMemo(() => {
    const byDate = reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return byDate;
    return byDate.filter((r) => {
      if (r.id.toLowerCase().includes(query)) return true;
      if (`#${r.id.slice(0, 4)}`.toLowerCase().includes(query)) return true;
      const branchText = r.mode === "staged" ? "staged" : (r.branch?.toLowerCase() ?? "main");
      if (branchText.includes(query)) return true;
      if (r.projectPath.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [reviews, selectedDateId, searchQuery]);

  const mappedRuns = useMemo<Run[]>(
    () =>
      filteredRuns.map((run) => ({
        id: run.id,
        displayId: `#${run.id.slice(0, 4)}`,
        branch: run.mode === "staged" ? "Staged" : run.branch ?? "Main",
        provider: "AI",
        timestamp: getTimestamp(run.createdAt),
        summary: getRunSummary(run),
        issues: [],
      })),
    [filteredRuns]
  );

  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const { review: reviewDetail } = useReviewDetail(selectedRunId);

  const issues = reviewDetail?.result?.issues;

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

  const sortedIssues = useMemo(() => {
    if (!issues) return [];
    return [...issues].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  }, [issues]);

  useHistoryKeyboard({
    focusZone,
    setFocusZone,
    selectedRunId,
    searchInputRef,
  });

  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "down") setFocusZone("runs");
  };

  const handleSearchEscape = () => {
    if (searchQuery) {
      setSearchQuery("");
    } else {
      searchInputRef.current?.blur();
      setFocusZone("runs");
    }
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    setFocusZone("timeline");
  };

  const handleRunActivate = (runId: string) => {
    navigate({ to: "/review/$reviewId", params: { reviewId: runId } });
  };

  const handleRunsBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("search");
      searchInputRef.current?.focus();
    }
  };

  const handleIssueClick = () => {
    if (selectedRunId) {
      navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
    }
  };

  return {
    isLoading,
    error,
    focusZone,
    searchQuery,
    searchInputRef,
    setSearchQuery,
    setFocusZone,
    timelineItems,
    selectedDateId,
    setSelectedDateId,
    selectedRunId,
    setSelectedRunId,
    mappedRuns,
    selectedRun,
    severityCounts,
    sortedIssues,
    duration,
    handleTimelineBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunActivate,
    handleRunsBoundary,
    handleIssueClick,
  };
}
