import { matchQueryState } from "@diffgazer/core/api/hooks";
import { deriveTrustStatus } from "@diffgazer/core/navigation";
import { isListNavigationKey, toVerticalBoundaryDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { Panel } from "@diffgazer/ui/components/panel";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { type KeyboardEvent, useRef } from "react";
import { TrustPanel } from "@/components/shared/trust-panel";
import { HistoryInsightsPane } from "@/features/history/components/insights-pane";
import { TimelineList } from "@/features/history/components/timeline-list";
import { useHistoryKeyboard } from "@/features/history/hooks/use-keyboard";
import { useHistoryPage } from "@/features/history/hooks/use-page";
import { useConfigData } from "@/hooks/use-config";

export function HistoryPage() {
  const { trust, repoRoot, projectId } = useConfigData();
  const { needsTrust } = deriveTrustStatus({ trust, projectId, repoRoot });

  if (needsTrust && projectId && repoRoot) {
    return <TrustPanel directory={repoRoot} projectId={projectId} />;
  }

  return <HistoryPageContent />;
}

function HistoryPageContent() {
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
    highlightedIssueId,
    setHighlightedIssueId,
  } = useHistoryPage();

  const runsListRef = useRef<HTMLDivElement>(null);
  const insightsListRef = useRef<HTMLDivElement>(null);
  const activeRunId = selectedRunId;

  useHistoryKeyboard({
    focusZone,
    setFocusZone,
    activeRunId,
    hasRuns: mappedRuns.length > 0,
    searchInputRef,
    runsListRef,
    insightsListRef,
    highlightedIssueId,
    onHighlightIssue: setHighlightedIssueId,
  });

  const handleRunsKeyDown = (event: KeyboardEvent) => {
    if (focusZone !== "runs") {
      if (isListNavigationKey(event.key)) event.preventDefault();
      return;
    }

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

  if (guard) return guard;

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2">
      <div className="flex items-center gap-6 mb-0 text-sm select-none shrink-0">
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
        prefix={
          <span aria-hidden="true" className="text-tui-blue font-bold">
            /
          </span>
        }
        className="border-tui-border bg-tui-bg text-sm"
      />

      <div data-row="history" className="flex flex-1 overflow-hidden gap-px">
        <Panel
          as="aside"
          aria-label="Review sections"
          data-pane="timeline"
          data-focused={focusZone === "timeline" || undefined}
          className="w-48 flex flex-col shrink-0 overflow-hidden border border-tui-border data-[focused]:border-tui-blue focus:outline-none"
        >
          <SectionHeader as="h2" variant="muted" bordered className="mb-0 p-3 border-tui-border">
            Sections
          </SectionHeader>
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
        </Panel>

        <Panel
          as="section"
          data-pane="runs"
          data-focused={focusZone === "runs" || undefined}
          className="flex-1 min-w-0 flex flex-col overflow-hidden border border-tui-border data-[focused]:border-tui-blue focus:outline-none"
        >
          <SectionHeader
            as="h2"
            variant="muted"
            bordered
            className="mb-0 flex justify-between overflow-hidden p-3 border-tui-border"
          >
            <span className="truncate">Reviews</span>
            <span className="shrink-0 ml-2">Sort: Recent</span>
          </SectionHeader>
          <div className="flex-1 overflow-y-auto p-2">
            {mappedRuns.length > 0 ? (
              <NavigationList
                ref={runsListRef}
                aria-label="Review runs"
                selectedId={selectedRunId}
                highlighted={focusZone === "runs" ? selectedRunId : null}
                onFocus={() => setFocusZone("runs")}
                onSelect={(id) => {
                  setFocusZone("runs");
                  setSelectedRunId(id);
                }}
                onEnter={handleRunActivate}
                onHighlightChange={setSelectedRunId}
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
                    className="border-b border-tui-border last:border-b-0"
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
              <EmptyState variant="inline" size="sm" live className="h-full">
                {emptyRunsMessage}
              </EmptyState>
            )}
          </div>
        </Panel>

        <Panel
          as="aside"
          aria-label="Review insights"
          data-pane="insights"
          data-focused={focusZone === "insights" || undefined}
          className="w-80 min-h-0 flex flex-col shrink-0 overflow-hidden border border-tui-border data-[focused]:border-tui-blue focus:outline-none"
        >
          <HistoryInsightsPane
            runId={selectedRun ? `#${selectedRun.id.slice(0, 4)}` : null}
            severityCounts={hasReviews ? severityCounts : null}
            issues={hasReviews ? sortedIssues : []}
            duration={duration}
            highlightedIssueId={highlightedIssueId}
            isFocused={focusZone === "insights"}
            listRef={insightsListRef}
            onSelectIssue={handleIssueClick}
            onHighlightIssue={setHighlightedIssueId}
            onListFocus={() => setFocusZone("insights")}
            onListBoundaryReached={(direction) => {
              if (direction === "previous") setFocusZone("runs");
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
