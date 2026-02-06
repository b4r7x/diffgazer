import { useState, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FocusablePane } from "@/components/ui";
import type { ReviewMetadata } from "@stargazer/schemas/review";
import type { ReviewResult } from "@stargazer/schemas/review";
import type { HistoryFocusZone } from "@/features/history/types";
import type { TimelineItem } from "@stargazer/schemas/ui";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScope, useKey } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { NavigationList } from "@/components/ui/navigation-list";
import { RunAccordionItem, TimelineList, HistoryInsightsPane, SearchInput, useReviews, useReviewDetail } from "@/features/history";

const HISTORY_FOOTER_SHORTCUTS = [
  { key: "Tab", label: "Switch Focus" },
  { key: "Enter", label: "Expand" },
  { key: "o", label: "Open" },
];

const HISTORY_FOOTER_RIGHT_SHORTCUTS = [
  { key: "r", label: "Resume" },
  { key: "e", label: "Export" },
  { key: "Esc", label: "Back" },
];

const FOCUS_LEFT: Record<HistoryFocusZone, HistoryFocusZone | null> = {
  timeline: null,
  runs: "timeline",
  insights: "runs",
  search: "insights",
};

const FOCUS_RIGHT: Record<HistoryFocusZone, HistoryFocusZone | null> = {
  timeline: "runs",
  runs: "insights",
  insights: "search",
  search: null,
};

function getDateKey(dateStr: string): string {
  return dateStr.slice(0, 10); // "2024-01-15T..." -> "2024-01-15"
}

function getDateLabel(dateStr: string): string {
  const dateKey = getDateKey(dateStr);
  const now = new Date();
  const today = getDateKey(now.toISOString());
  const yesterday = getDateKey(new Date(now.getTime() - 86400000).toISOString());

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getRunSummary(metadata: ReviewMetadata): React.ReactNode {
  const { blockerCount, highCount, mediumCount, lowCount, issueCount } = metadata;

  if (issueCount === 0) return "Passed with no issues.";

  const parts: React.ReactNode[] = [];

  if (blockerCount > 0) parts.push(<span key="blocker" className="text-tui-red">{blockerCount} blocker</span>);
  if (highCount > 0) parts.push(<span key="high" className="text-tui-yellow">{highCount} high</span>);
  if (mediumCount > 0) parts.push(<span key="medium" className="text-tui-blue">{mediumCount} medium</span>);
  if (lowCount > 0) parts.push(<span key="low" className="text-tui-cyan">{lowCount} low</span>);

  if (parts.length === 0) {
    return `Found ${issueCount} issue${issueCount === 1 ? "" : "s"}.`;
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {part}
        </span>
      ))}
    </>
  );
}

function buildTimelineItems(reviews: ReviewMetadata[]): TimelineItem[] {
  const groups = new Map<string, { label: string; count: number }>();

  for (const review of reviews) {
    const key = getDateKey(review.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { label: getDateLabel(review.createdAt), count: 1 });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([id, { label, count }]) => ({ id, label, count }));
}

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

  const issues = (reviewDetail?.result as ReviewResult | undefined)?.issues;

  const severityCounts = selectedRun
    ? {
        blocker: selectedRun.blockerCount,
        high: selectedRun.highCount,
        medium: selectedRun.mediumCount,
        low: selectedRun.lowCount,
        nit: selectedRun.nitCount,
      }
    : null;

  const durationMs = selectedRun?.durationMs;
  let duration = "--";
  if (durationMs) {
    const seconds = Math.floor(durationMs / 1000);
    if (seconds === 0) duration = `${durationMs}ms`;
    else if (seconds < 60) duration = `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
    else {
      const minutes = Math.floor(seconds / 60);
      duration = `${minutes}m ${seconds % 60}s`;
    }
  }

  const sortedIssues = useMemo(() => {
    if (!issues) return [];
    return [...issues].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  }, [issues]);

  useScope("history");

  useKey("Tab", () => {
    const zones: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];
    setFocusZone((prev) => zones[(zones.indexOf(prev) + 1) % zones.length]);
  });

  useKey("ArrowLeft", () => {
    const next = FOCUS_LEFT[focusZone];
    if (next) setFocusZone(next);
  });

  useKey("ArrowRight", () => {
    const next = FOCUS_RIGHT[focusZone];
    if (next) setFocusZone(next);
  });

  useKey("/", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  }, { enabled: focusZone !== "search" });

  const navigateToSelectedRun = () => {
    if (selectedRunId) {
      navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
    }
  };

  useKey("o", navigateToSelectedRun, { enabled: focusZone === "runs" });
  useKey(" ", navigateToSelectedRun, { enabled: focusZone === "runs" });

  useKey("Escape", () => {
    if (expandedRunId) {
      setExpandedRunId(null);
    } else {
      navigate({ to: "/" });
    }
  });

  usePageFooter({
    shortcuts: HISTORY_FOOTER_SHORTCUTS,
    rightShortcuts: HISTORY_FOOTER_RIGHT_SHORTCUTS
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
                    id={run.id}
                    displayId={`#${run.id.slice(0, 4)}`}
                    branch={run.mode === "staged" ? "Staged" : run.branch ?? "Main"}
                    provider="AI"
                    timestamp={getTimestamp(run.createdAt)}
                    summary={getRunSummary(run)}
                    issues={[]}
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
