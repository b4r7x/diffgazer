import {
  buildDuplicateCollapseNotice,
  buildLensFailureNotice,
  formatRunId,
  selectDetailsEmptyKind,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane/pane";
import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { useReviewResultsKeyboard } from "../hooks/use-results-keyboard";

interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  initialIssueId?: string | null;
  droppedDuplicates?: number;
  lensStats?: LensStat[];
}

export function ReviewResultsView({
  issues,
  reviewId,
  initialIssueId,
  droppedDuplicates,
  lensStats,
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
    mobilePane,
    backToList,
  } = useReviewResultsKeyboard({ issues, initialIssueId });
  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, issues.length);
  // A run that lost lenses must say so wherever it is opened, not only in the
  // live progress view - otherwise a partial result reads as a complete one.
  const completenessNotice = buildLensFailureNotice(lensStats);
  // Below md only the active pane is shown; both stay side-by-side from md up.
  const listPaneClassName = mobilePane === "details" ? "hidden md:flex" : undefined;
  const detailsPaneClassName = mobilePane === "list" ? "hidden md:flex" : undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2 font-mono">
      <div className="py-2 mb-2 shrink-0">
        <SectionHeader as="h2" variant="accent">
          Review {reviewId ? formatRunId(reviewId) : "#unknown"}
        </SectionHeader>
        {completenessNotice ? (
          <p
            className="mt-1 border-l-2 border-warning-border pl-2 text-xs text-warning-text"
            role="note"
          >
            {completenessNotice}
          </p>
        ) : null}
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
        <div
          data-row="review"
          data-mobile-pane={mobilePane}
          className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row"
        >
          <IssueListPane
            issues={filteredIssues}
            allIssues={issues}
            selectedIssueId={selectedIssueId}
            highlightedIssueId={highlightedIssueId}
            onSelectIssue={selectIssueAndFocusList}
            onHighlightIssue={selectIssue}
            onListBoundaryReached={handleListBoundary}
            onListFocus={handleListFocus}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            onSeverityFilterReset={resetSeverityFilter}
            onSeverityFilterBoundary={handleSeverityFilterBoundary}
            focusedFilterIndex={focusedFilterIndex}
            onFocusedFilterIndexChange={setFocusedFilterIndex}
            isFilterFocused={focusZone === "filters"}
            onFilterKeyDown={handleFilterKeyDown}
            filterRef={filterRef}
            listRef={listRef}
            listBodyRef={listBodyRef}
            isFocused={focusZone === "list"}
            className={listPaneClassName}
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
            onBackToList={backToList}
            className={detailsPaneClassName}
          />
        </div>
      </section>
    </div>
  );
}
