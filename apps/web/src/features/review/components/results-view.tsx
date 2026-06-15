import { selectDetailsEmptyKind } from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane";
import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { useReviewResultsKeyboard } from "../hooks/use-results-keyboard";

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
    selectIssueAndFocusList,
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
    focusedStepIndex,
  } = useReviewResultsKeyboard({ issues, initialIssueId });
  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2 font-mono">
      <div className="flex items-center gap-4 py-2 mb-2 shrink-0">
        <span className="text-sm font-medium text-accent">Review #{reviewId ?? "unknown"}</span>
      </div>
      {/* The issue list + details split is a genuinely two-dimensional layout
          (WCAG 1.4.10 exception), so this region keeps a minimum width while the
          shell reflows; text/form screens have no shell-level width lock. */}
      <div data-row="review" className="flex flex-1 overflow-hidden min-w-[768px]">
        <IssueListPane
          listState={{
            issues: filteredIssues,
            allIssues: issues,
            selectedIssueId,
            highlightedIssueId,
          }}
          callbacks={{
            onSelectIssue: selectIssueAndFocusList,
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
          focusedStepIndex={focusedStepIndex}
          scrollAreaRef={detailsScrollRef}
          isFocused={focusZone === "details"}
          emptyKind={detailsEmptyKind}
        />
      </div>
    </div>
  );
}
