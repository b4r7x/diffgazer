import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FocusablePane, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { HistoryTabId, HistoryFocusZone } from "@repo/schemas/history";
import type { TimelineItem } from "@repo/schemas/ui";
import { useScope, useKey } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { RunAccordionItem, TimelineList, HistoryInsightsPane, useReviews } from "@/features/history";

function getDateKey(dateStr: string): string {
  return dateStr.slice(0, 10); // "2024-01-15T..." -> "2024-01-15"
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10);
  const dateKey = getDateKey(dateStr);

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getRunSummary(metadata: ReviewHistoryMetadata): React.ReactNode {
  const { criticalCount, warningCount, issueCount } = metadata;

  if (criticalCount > 0) {
    return (
      <>
        Found <span className="text-tui-red font-bold">{criticalCount} critical</span> issue
        {criticalCount !== 1 ? "s" : ""}.
      </>
    );
  }
  if (warningCount > 0) {
    return (
      <>
        Found <span className="text-tui-yellow font-bold">{warningCount} warning</span>
        {warningCount !== 1 ? "s" : ""}.
      </>
    );
  }
  if (issueCount > 0) {
    return `Found ${issueCount} issue${issueCount !== 1 ? "s" : ""}.`;
  }
  return "Passed with no issues.";
}

function buildTimelineItems(reviews: ReviewHistoryMetadata[]): TimelineItem[] {
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
  const [activeTab, setActiveTab] = useState<HistoryTabId>("runs");
  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const timelineItems = useMemo(() => buildTimelineItems(reviews), [reviews]);

  const defaultDateId = timelineItems[0]?.id ?? "";
  const [selectedDateId, setSelectedDateId] = useScopedRouteState("date", defaultDateId);
  const [selectedRunId, setSelectedRunId] = useScopedRouteState("run", reviews[0]?.id ?? null);

  const filteredRuns = useMemo(
    () => reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId),
    [reviews, selectedDateId]
  );

  const selectedRun = reviews.find((r) => r.id === selectedRunId) ?? null;

  const severityCounts = {
    blocker: selectedRun?.criticalCount ?? 0,
    high: selectedRun?.warningCount ?? 0,
    medium: 0,
    low: 0,
    nit: 0,
  };

  // Keyboard scope
  useScope("history");

  // Tab switching
  useKey("Tab", () => {
    setFocusZone((prev) => {
      if (prev === "timeline") return "runs";
      if (prev === "runs") return "insights";
      return "timeline";
    });
  });

  // Arrow navigation between zones
  useKey("ArrowLeft", () => {
    if (focusZone === "runs") setFocusZone("timeline");
    else if (focusZone === "insights") setFocusZone("runs");
  });

  useKey("ArrowRight", () => {
    if (focusZone === "timeline") setFocusZone("runs");
    else if (focusZone === "runs") setFocusZone("insights");
  });

  // Expand/collapse with Enter
  useKey(
    "Enter",
    () => {
      if (focusZone === "runs" && selectedRunId) {
        setExpandedRunId((prev) => (prev === selectedRunId ? null : selectedRunId));
      }
    },
    { enabled: focusZone === "runs" }
  );

  // Open in full review
  useKey(
    "o",
    () => {
      if (selectedRunId) {
        navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
      }
    },
    { enabled: focusZone === "runs" }
  );

  // Escape handling
  useKey("Escape", () => {
    if (expandedRunId) {
      setExpandedRunId(null);
    } else {
      navigate({ to: "/" });
    }
  });

  // Page footer shortcuts
  usePageFooter({
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "Enter", label: "Expand" },
      { key: "o", label: "Open" },
    ],
    rightShortcuts: [
      { key: "r", label: "Resume" },
      { key: "e", label: "Export" },
      { key: "Esc", label: "Back" },
    ],
  });

  // Handle boundary navigation
  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "down") setFocusZone("runs");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-gray-500">
        <span>Loading reviews...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-tui-red">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-0">
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-tui-border mb-0 text-sm select-none shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HistoryTabId)}>
          <TabsList className="border-b-0">
            <TabsTrigger value="runs">[Runs]</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden border-x border-b border-tui-border">
        {/* Timeline (left) */}
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

        {/* Runs (middle) */}
        <FocusablePane
          isFocused={focusZone === "runs"}
          className="flex-1 min-w-0 border-r border-tui-border flex flex-col overflow-hidden"
        >
          <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border flex justify-between overflow-hidden">
            <span className="truncate">Runs</span>
            <span className="shrink-0 ml-2">Sort: Recent</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "runs" ? (
              filteredRuns.length > 0 ? (
                filteredRuns.map((run) => (
                  <RunAccordionItem
                    key={run.id}
                    id={run.id}
                    displayId={`#${run.id.slice(0, 4)}`}
                    branch={run.staged ? "Staged" : run.branch ?? "Main"}
                    provider="AI"
                    timestamp={getTimestamp(run.createdAt)}
                    summary={getRunSummary(run)}
                    issues={[]}
                    isSelected={run.id === selectedRunId}
                    isExpanded={run.id === expandedRunId}
                    onSelect={() => setSelectedRunId(run.id)}
                    onToggleExpand={() => setExpandedRunId((prev) => (prev === run.id ? null : run.id))}
                    onIssueClick={() => navigate({ to: "/review/$reviewId", params: { reviewId: run.id } })}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No runs for this date
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No sessions available</div>
            )}
          </div>
        </FocusablePane>

        {/* Insights (right) */}
        <FocusablePane isFocused={focusZone === "insights"} className="w-80 flex flex-col shrink-0 overflow-hidden">
          <HistoryInsightsPane
            runId={selectedRun ? `#${selectedRun.id.slice(0, 4)}` : null}
            severityCounts={severityCounts}
            topLenses={[]}
            topIssues={[]}
            duration="--"
            onIssueClick={() => {
              if (selectedRunId) {
                navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
              }
            }}
          />
        </FocusablePane>
      </div>

      {/* Search bar placeholder */}
      <div className="flex items-center gap-2 p-3 bg-tui-bg border-x border-b border-tui-border text-sm font-mono shrink-0">
        <span className="text-tui-blue font-bold">&gt;</span>
        <span className="text-gray-500">Search runs by ID, provider or tag...</span>
        <span className="w-2 h-4 bg-tui-blue opacity-50 animate-pulse" />
      </div>
    </div>
  );
}
