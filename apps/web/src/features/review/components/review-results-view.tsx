import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { selectDetailsEmptyKind } from "@diffgazer/core/review";
import { useReviewResultsKeyboard } from "../hooks/use-review-results-keyboard";

interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
}

export function ReviewResultsView({ issues, reviewId }: ReviewResultsViewProps) {
  const {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    setSelectedIssueId,
    selectIssue,
    handleListBoundary,
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    resetSeverityFilter,
    focusZone,
    focusedFilterIndex,
    setFocusedFilterIndex,
    filterRef,
    handleFilterKeyDown,
    handleSeverityFilterBoundary,
    highlightedIssueId,
    handleListFocus,
    listRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
  } = useReviewResultsKeyboard({ issues });
  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2 font-mono">
      <div className="flex items-center gap-4 py-2 mb-2 shrink-0">
        <span className="text-sm font-medium text-tui-violet">
          Analysis #{reviewId ?? "unknown"}
        </span>
      </div>
      <div data-row="review" className="flex flex-1 overflow-hidden">
        <IssueListPane
          issues={filteredIssues}
          allIssues={issues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={setSelectedIssueId}
          onHighlightIssue={selectIssue}
          onListBoundaryReached={handleListBoundary}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          onSeverityFilterReset={resetSeverityFilter}
          onSeverityFilterBoundary={handleSeverityFilterBoundary}
          isFocused={focusZone === "list"}
          isFilterFocused={focusZone === "filters"}
          focusedFilterIndex={focusedFilterIndex}
          onFocusedFilterIndexChange={setFocusedFilterIndex}
          filterRef={filterRef}
          onFilterKeyDown={handleFilterKeyDown}
          highlightedIssueId={highlightedIssueId}
          onListFocus={handleListFocus}
          listRef={listRef}
        />
        <IssueDetailsPane
          issue={selectedIssue}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          completedSteps={completedSteps}
          onToggleStep={handleToggleStep}
          scrollAreaRef={detailsScrollRef}
          isFocused={focusZone === "details"}
          emptyKind={detailsEmptyKind}
        />
      </div>
    </div>
  );
}
