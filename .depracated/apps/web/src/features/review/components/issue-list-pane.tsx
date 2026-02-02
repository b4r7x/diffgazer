import { cn } from "@/lib/utils";
import { IssueListItem, SeverityFilterGroup, FocusablePane, type SeverityFilter } from "@/components/ui";
import { calculateSeverityCounts } from "@repo/core";
import type { TriageIssue } from "@repo/schemas";

export interface IssueListPaneProps {
  issues: TriageIssue[];
  allIssues: TriageIssue[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (filter: SeverityFilter) => void;
  isFocused: boolean;
  isFilterFocused?: boolean;
  focusedFilterIndex?: number;
  title?: string;
  className?: string;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedIndex,
  onSelectIndex,
  severityFilter,
  onSeverityFilterChange,
  isFocused,
  isFilterFocused,
  focusedFilterIndex,
  title = "Analysis",
  className,
}: IssueListPaneProps) {
  const counts = calculateSeverityCounts(allIssues);

  return (
    <FocusablePane
      isFocused={isFocused}
      className={cn("w-2/5 flex flex-col border-r border-tui-border pr-4", className)}
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

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1">
        {issues.map((issue, index) => (
          <IssueListItem
            key={issue.id}
            issue={issue}
            isSelected={index === selectedIndex}
            onClick={() => onSelectIndex(index)}
          />
        ))}
        {issues.length === 0 && (
          <div className="text-gray-500 text-sm p-2">No issues match filter</div>
        )}
      </div>
    </FocusablePane>
  );
}
