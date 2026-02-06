import { useState, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FocusablePane } from "@/components/ui/focusable-pane";
import type { ReviewResult } from "@stargazer/schemas/review";
import type { HistoryFocusZone } from "@/features/history/types";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { NavigationList } from "@/components/ui/navigation-list";
import { RunAccordionItem } from "@/features/history/components/run-accordion-item";
import { TimelineList } from "@/features/history/components/timeline-list";
import { HistoryInsightsPane } from "@/features/history/components/history-insights-pane";
import { SearchInput } from "@/features/history/components/search-input";
import { useReviews } from "@/features/history/hooks/use-reviews";
import { useReviewDetail } from "@/features/history/hooks/use-review-detail";
import { useHistoryKeyboard } from "@/features/history/hooks/use-history-keyboard";
import { getDateKey, getTimestamp, getRunSummary, buildTimelineItems, formatDuration } from "@/features/history/utils";

export function HistoryPage() {
  const navigate = useNavigate();
  const { reviews, isLoading, error } = useReviews();
  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
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

  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const { review: reviewDetail } = useReviewDetail(selectedRunId);

  const issues = reviewDetail?.result
    ? (reviewDetail.result as ReviewResult).issues
    : undefined;

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
    expandedRunId,
    setExpandedRunId,
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

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-gray-500">
        <span>Loading reviews...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-tui-red">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-0">
      <div className="flex items-center gap-6 border-b border-tui-border mb-0 text-sm select-none shrink-0">
        <span className="py-2 text-sm font-medium">Reviews</span>
      </div>

      <SearchInput
        ref={searchInputRef}
        value={searchQuery}
        onChange={setSearchQuery}
        onFocus={() => setFocusZone("search")}
        onEscape={handleSearchEscape}
        onArrowDown={handleSearchArrowDown}
      />

      <div className="flex flex-1 overflow-hidden border-x border-b border-tui-border">
        <FocusablePane
          isFocused={focusZone === "timeline"}
          className="w-48 border-r border-tui-border flex flex-col shrink-0"
        >
          <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border">
            Timeline
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {timelineItems.length > 0 ? (
              <TimelineList
                items={timelineItems}
                selectedId={selectedDateId}
                onSelect={setSelectedDateId}
                keyboardEnabled={focusZone === "timeline"}
                onBoundaryReached={handleTimelineBoundary}
              />
            ) : (
              <div className="text-gray-500 text-sm p-2">No reviews yet</div>
            )}
          </div>
        </FocusablePane>

        <FocusablePane
          isFocused={focusZone === "runs"}
          className="flex-1 min-w-0 border-r border-tui-border flex flex-col overflow-hidden"
        >
          <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border flex justify-between overflow-hidden">
            <span className="truncate">Reviews</span>
            <span className="shrink-0 ml-2">Sort: Recent</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRuns.length > 0 ? (
              <NavigationList
                selectedId={selectedRunId}
                onSelect={setSelectedRunId}
                onActivate={handleRunActivate}
                keyboardEnabled={focusZone === "runs"}
                onBoundaryReached={handleRunsBoundary}
              >
                {filteredRuns.map((run) => (
                  <RunAccordionItem
                    key={run.id}
                    run={{
                      id: run.id,
                      displayId: `#${run.id.slice(0, 4)}`,
                      branch: run.mode === "staged" ? "Staged" : run.branch ?? "Main",
                      provider: "AI",
                      timestamp: getTimestamp(run.createdAt),
                      summary: getRunSummary(run),
                      issues: [],
                    }}
                    isSelected={run.id === selectedRunId}
                    isExpanded={run.id === expandedRunId}
                    onSelect={() => setSelectedRunId(run.id)}
                    onOpen={() => navigate({ to: "/review/$reviewId", params: { reviewId: run.id } })}
                  />
                ))}
              </NavigationList>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No runs for this date
              </div>
            )}
          </div>
        </FocusablePane>

        <FocusablePane isFocused={focusZone === "insights"} className="w-80 flex flex-col shrink-0 overflow-hidden">
          <HistoryInsightsPane
            runId={selectedRun ? `#${selectedRun.id.slice(0, 4)}` : null}
            severityCounts={severityCounts}
            issues={sortedIssues}
            duration={duration}
            onIssueClick={() => {
              if (selectedRunId) {
                navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
              }
            }}
          />
        </FocusablePane>
      </div>
    </div>
  );
}
