import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane";
import type { ReviewIssue } from "@diffgazer/schemas/review";
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
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    focusZone,
    focusedFilterIndex,
    focusedValue,
    listRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
  } = useReviewResultsKeyboard({ issues });

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 font-mono">
      <div className="flex items-center gap-4 py-2 border-b border-tui-border mb-2 shrink-0">
        <span className="text-sm font-medium text-tui-violet">
          Analysis #{reviewId ?? "unknown"}
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <IssueListPane
          issues={filteredIssues}
          allIssues={issues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={setSelectedIssueId}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          isFocused={focusZone === "list"}
          isFilterFocused={focusZone === "filters"}
          focusedFilterIndex={focusedFilterIndex}
          focusedValue={focusedValue}
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
        />
      </div>
    </div>
  );
}
