import type { Ref } from "react";
import { cn } from "@/utils/cn";
import { IssueListItem } from "@/components/ui/issue";
import { SeverityFilterGroup, type SeverityFilter } from "./severity-filter-group";
import { FocusablePane } from "@stargazer/ui";
import { calculateSeverityCounts } from "@stargazer/core/severity";
import type { ReviewIssue } from "@stargazer/schemas/review";

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (filter: SeverityFilter) => void;
  isFocused: boolean;
  isFilterFocused?: boolean;
  focusedFilterIndex?: number;
  focusedValue?: string | null;
  listRef?: Ref<HTMLDivElement>;
  title?: string;
  className?: string;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedIssueId,
  onSelectIssue,
  severityFilter,
  onSeverityFilterChange,
  isFocused,
  isFilterFocused,
  focusedFilterIndex,
  focusedValue,
  listRef,
  title = "Analysis",
  className,
}: IssueListPaneProps) {
  const counts = calculateSeverityCounts(allIssues);

  return (
    <FocusablePane
      isFocused={isFocused}
      className={cn("w-2/5 flex flex-col border-r border-tui-border pr-4 min-h-0", className)}
    >
      <div className="pb-4 pt-2">
        <div className="text-tui-violet font-bold mb-2">{title}</div>
        <SeverityFilterGroup
          counts={counts}
          activeFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          isFocused={isFilterFocused}
          focusedIndex={focusedFilterIndex}
        />
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-hide space-y-1">
        {issues.map((issue) => (
          <IssueListItem
            key={issue.id}
            issue={issue}
            isSelected={issue.id === selectedIssueId || issue.id === focusedValue}
            onClick={() => onSelectIssue(issue.id)}
          />
        ))}
        {issues.length === 0 && (
          <div className="text-tui-muted text-sm p-2">No issues match filter</div>
        )}
      </div>
    </FocusablePane>
  );
}
