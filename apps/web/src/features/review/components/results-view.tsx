import {
  buildDuplicateCollapseNotice,
  formatRunId,
  selectDetailsEmptyKind,
} from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane/pane";
import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { useReviewResultsKeyboard } from "../hooks/use-results-keyboard";

interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  initialIssueId?: string | null;
  droppedDuplicates?: number;
}

export function ReviewResultsView({
  issues,
  reviewId,
  initialIssueId,
  droppedDuplicates,
}: ReviewResultsViewProps) {
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
    handleDetailsTabsBoundary,
    highlightedIssueId,
    handleListFocus,
    listRef,
    listBodyRef,
    detailsPaneRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
    focusedStepIndex,
    setFocusedStepIndex,
  } = useReviewResultsKeyboard({ issues, initialIssueId });
  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, issues.length);

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2 font-mono">
      <div className="py-2 mb-2 shrink-0">
        <span className="text-sm font-medium text-accent">
          Review {reviewId ? formatRunId(reviewId) : "#unknown"}
        </span>
        {duplicateNotice ? (
          <p className="mt-1 text-xs text-muted-foreground" role="note">
            {duplicateNotice}
          </p>
        ) : null}
      </div>
      <section
        aria-label="Review result panes"
        data-viewport="review-results"
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        <div data-row="review" className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
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
            refs={{ filterRef, listRef, listBodyRef }}
            ui={{ isFocused: focusZone === "list" }}
          />
          <IssueDetailsPane
            issue={selectedIssue}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onTabsBoundaryReached={handleDetailsTabsBoundary}
            completedSteps={completedSteps}
            onToggleStep={handleToggleStep}
            focusedStepIndex={focusedStepIndex}
            onFocusedStepIndexChange={setFocusedStepIndex}
            paneRef={detailsPaneRef}
            scrollAreaRef={detailsScrollRef}
            isFocused={focusZone === "details"}
            emptyKind={detailsEmptyKind}
          />
        </div>
      </section>
    </div>
  );
}
