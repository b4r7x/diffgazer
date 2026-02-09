import { useRef } from "react";
import { FocusablePane, NavigationList } from "@diffgazer/ui";
import { useNavigation } from "@diffgazer/keyboard";
import { RunAccordionItem } from "@/features/history/components/run-accordion-item";
import { TimelineList } from "@/features/history/components/timeline-list";
import { HistoryInsightsPane } from "@/features/history/components/history-insights-pane";
import { SearchInput } from "@/features/history/components/search-input";
import { useHistoryPage } from "@/features/history/hooks/use-history-page";

export function HistoryPage() {
  const runsListRef = useRef<HTMLDivElement>(null);
  const {
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
    hasReviews,
    emptyRunsMessage,
    handleTimelineBoundary,
    handleRunsBoundary,
    handleSearchEscape,
    handleSearchArrowDown,
    handleRunActivate,
    handleIssueClick,
  } = useHistoryPage();

  const { focusedValue: runsFocusedValue } = useNavigation({
    containerRef: runsListRef,
    role: "option",
    enabled: focusZone === "runs",
    value: selectedRunId,
    onValueChange: setSelectedRunId,
    onSelect: handleRunActivate,
    onEnter: handleRunActivate,
    wrap: false,
    onBoundaryReached: handleRunsBoundary,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-tui-muted">
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
          <div className="p-3 text-xs text-tui-muted font-bold uppercase tracking-wider border-b border-tui-border">
            Sections
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TimelineList
              items={timelineItems}
              selectedId={selectedDateId}
              onSelect={setSelectedDateId}
              keyboardEnabled={focusZone === "timeline"}
              onBoundaryReached={handleTimelineBoundary}
            />
          </div>
        </FocusablePane>

        <FocusablePane
          isFocused={focusZone === "runs"}
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
                selectedId={selectedRunId}
                focusedValue={focusZone === "runs" ? runsFocusedValue : null}
                onSelect={setSelectedRunId}
                onActivate={handleRunActivate}
                isFocused={focusZone === "runs"}
              >
                {mappedRuns.map((run) => (
                  <RunAccordionItem
                    key={run.id}
                    run={run}
                    isSelected={run.id === selectedRunId}
                    isActive={focusZone === "runs" && run.id === runsFocusedValue}
                    onSelect={() => setSelectedRunId(run.id)}
                    onOpen={() => handleRunActivate(run.id)}
                  />
                ))}
              </NavigationList>
            ) : (
              <div className="flex items-center justify-center h-full text-tui-muted">
                {emptyRunsMessage}
              </div>
            )}
          </div>
        </FocusablePane>

        <FocusablePane isFocused={focusZone === "insights"} className="w-80 flex flex-col shrink-0 overflow-hidden">
          <HistoryInsightsPane
            runId={selectedRun ? `#${selectedRun.id.slice(0, 4)}` : null}
            severityCounts={hasReviews ? severityCounts : null}
            issues={hasReviews ? sortedIssues : []}
            duration={duration}
            onIssueClick={handleIssueClick}
          />
        </FocusablePane>
      </div>
    </div>
  );
}
