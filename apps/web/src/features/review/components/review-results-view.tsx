import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { selectDetailsEmptyKind } from "@diffgazer/core/review";
import { useReviewResultsKeyboard } from "../hooks/use-review-results-keyboard";

interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  initialIssueId?: string | null;
}

export function ReviewResultsView({ issues, reviewId, initialIssueId }: ReviewResultsViewProps) {
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
  } = useReviewResultsKeyboard({ issues, initialIssueId });
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
          listState={{
            issues: filteredIssues,
            allIssues: issues,
            selectedIssueId,
            highlightedIssueId,
          }}
          callbacks={{
            onSelectIssue: setSelectedIssueId,
            onHighlightIssue: selectIssue,
            onListBoundaryReached: handleListBoundary,
            onListFocus: handleListFocus,
          }}
          filter={{
            severityFilter,
            onSeverityFilterChange: setSeverityFilter,
            onSeverityFilterReset: resetSeverityFilter,
            onSeverityFilterBoundary: handleSeverityFilterBoundary,
            focusedFilterIndex,
            onFocusedFilterIndexChange: setFocusedFilterIndex,
            isFilterFocused: focusZone === "filters",
            onFilterKeyDown: handleFilterKeyDown,
          }}
          refs={{ filterRef, listRef }}
          ui={{ isFocused: focusZone === "list" }}
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
