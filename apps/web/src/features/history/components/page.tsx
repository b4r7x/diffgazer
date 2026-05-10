import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { matchQueryState } from "@diffgazer/core/api/hooks";
import { TimelineList } from "@/features/history/components/timeline-list";
import { HistoryInsightsPane } from "@/features/history/components/history-insights-pane";
import { useHistoryKeyboard } from "@/features/history/hooks/use-history-keyboard";
import { useHistoryPage } from "@/features/history/hooks/use-history-page";
import { toVerticalBoundaryDirection } from "@/lib/vertical-navigation";

export function HistoryPage() {
  const {
    reviewsQuery,
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
    hasReviews,
    emptyRunsMessage,
    handleTimelineBoundary,
    handleRunsBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunActivate,
    handleIssueClick,
  } = useHistoryPage();

  const [runsFocusedValue, setRunsFocusedValue] = useState<string | null>(null);
  const runsListRef = useRef<HTMLDivElement>(null);
  const runsHighlightedId = mappedRuns.some((run) => run.id === runsFocusedValue)
    ? runsFocusedValue
    : null;
  const activeRunId = runsHighlightedId ?? selectedRunId;

  useHistoryKeyboard({
    focusZone,
    setFocusZone,
    activeRunId,
    searchInputRef,
  });

  const handleRunsKeyDown = (event: KeyboardEvent) => {
    if (event.key === " " && activeRunId) {
      event.preventDefault();
      handleRunActivate(activeRunId);
    }
  };

  const guard = matchQueryState(reviewsQuery, {
    loading: () => (
      <div className="flex flex-col flex-1 items-center justify-center text-tui-muted">
        <span>Loading reviews...</span>
      </div>
    ),
    error: (err) => (
      <div className="flex flex-col flex-1 items-center justify-center text-tui-red">
        <span>Error: {err.message}</span>
      </div>
    ),
    success: () => null,
  });

  const isReady = guard === null;

  useEffect(() => {
    if (!isReady || focusZone !== "runs") return;

    const runsList = runsListRef.current;
    if (!runsList) return;

    const activeElement = runsList.ownerDocument.activeElement;
    const View = runsList.ownerDocument.defaultView;
    if (View && activeElement instanceof View.HTMLElement && runsList.contains(activeElement)) return;

    runsList.focus();
  }, [focusZone, isReady, mappedRuns.length]);

  if (guard) return guard;

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
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            handleSearchArrowDown();
          }
        }}
        placeholder="Search runs by ID..."
        prefix={<span aria-hidden="true" className="text-tui-blue font-bold">/</span>}
        className="border-tui-border bg-tui-bg text-sm"
      />

      <div className="flex flex-1 overflow-hidden border-x border-b border-tui-border">
        <div
          data-focused={focusZone === "timeline" || undefined}
          className="w-48 border-r border-tui-border flex flex-col shrink-0"
        >
          <div className="p-3 text-xs text-tui-muted font-bold uppercase tracking-wider border-b border-tui-border">
            Sections
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TimelineList
              items={timelineItems}
              selectedId={selectedDateId}
              onSelect={(id) => {
                setFocusZone("timeline");
                setSelectedDateId(id);
              }}
              onFocus={() => setFocusZone("timeline")}
              keyboardEnabled={focusZone === "timeline"}
              onBoundaryReached={handleTimelineBoundary}
            />
          </div>
        </div>

        <div
          data-focused={focusZone === "runs" || undefined}
          className="flex-1 min-w-0 border-r border-tui-border flex flex-col overflow-hidden"
        >
          <div className="p-3 text-xs text-tui-muted font-bold uppercase tracking-wider border-b border-tui-border flex justify-between overflow-hidden">
            <span className="truncate">Reviews</span>
            <span className="shrink-0 ml-2">Sort: Recent</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mappedRuns.length > 0 ? (
              <NavigationList
                ref={runsListRef}
                aria-label="Review runs"
                selectedId={selectedRunId}
                highlightedId={focusZone === "runs" ? runsHighlightedId : null}
                onSelect={setSelectedRunId}
                onEnter={handleRunActivate}
                onHighlightChange={setRunsFocusedValue}
                onNavigationBoundaryReached={(direction) => {
                  if (direction === "previous") {
                    handleRunsBoundary(toVerticalBoundaryDirection(direction));
                  }
                }}
                onKeyDown={handleRunsKeyDown}
                wrap={false}
                focused={focusZone === "runs"}
              >
                {mappedRuns.map((run) => (
                  <NavigationList.Item
                    key={run.id}
                    id={run.id}
                    onDoubleClick={() => handleRunActivate(run.id)}
                    className="border-b border-tui-border"
                  >
                    <NavigationList.Title>{run.displayId}</NavigationList.Title>
                    <NavigationList.Status className="text-tui-muted group-data-[active]:text-primary-foreground/70">
                      {run.timestamp}
                    </NavigationList.Status>
                    <NavigationList.Meta className="min-w-0 flex-wrap">
                      <NavigationList.Badge variant="neutral" size="sm">
                        {run.branch}
                      </NavigationList.Badge>
                      <NavigationList.Subtitle>{run.provider}</NavigationList.Subtitle>
                      <span className="min-w-full line-clamp-2 text-sm text-muted-foreground group-data-[active]:text-primary-foreground/85">
                        {run.summary}
                      </span>
                    </NavigationList.Meta>
                  </NavigationList.Item>
                ))}
              </NavigationList>
            ) : (
              <div className="flex items-center justify-center h-full text-tui-muted">
                {emptyRunsMessage}
              </div>
            )}
          </div>
        </div>

        <div
          data-focused={focusZone === "insights" || undefined}
          className="w-80 min-h-0 flex flex-col shrink-0 overflow-hidden"
        >
          <HistoryInsightsPane
            runId={selectedRun ? `#${selectedRun.id.slice(0, 4)}` : null}
            severityCounts={hasReviews ? severityCounts : null}
            issues={hasReviews ? sortedIssues : []}
            duration={duration}
            onIssueClick={handleIssueClick}
          />
        </div>
      </div>
    </div>
  );
}
