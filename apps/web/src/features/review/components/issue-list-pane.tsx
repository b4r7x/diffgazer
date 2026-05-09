import type { Ref } from "react";
import { cn } from "@diffgazer/core/cn";
import { SeverityFilterGroup, type SeverityFilter } from "./severity-filter-group";
import { calculateSeverityCounts } from "@diffgazer/core/schemas/ui";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

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
  onFocusedFilterIndexChange?: (index: number) => void;
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
  onFocusedFilterIndexChange,
  focusedValue,
  listRef,
  title = "Analysis",
  className,
}: IssueListPaneProps) {
  const counts = calculateSeverityCounts(allIssues);

  return (
    <div
      data-focused={isFocused || undefined}
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
          onFocusedIndexChange={onFocusedFilterIndexChange}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <NavigationList
          ref={listRef}
          aria-label={title}
          selectedId={selectedIssueId}
          highlightedId={focusedValue}
          onSelect={onSelectIssue}
          focused={isFocused}
          wrap={false}
          className="space-y-1"
        >
          {issues.map((issue) => {
            const config = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.medium;
            return (
              <NavigationList.Item
                key={issue.id}
                id={issue.id}
                density="compact"
                className={cn(!isFocused && selectedIssueId === issue.id && "border-l-2 border-l-tui-blue/60")}
              >
                <NavigationList.Title className="min-w-0">
                  <span className={cn("mr-2", config.color)} aria-hidden="true">
                    {config.icon}
                  </span>
                  <span className="min-w-0 truncate">{issue.title}</span>
                </NavigationList.Title>
                <NavigationList.Meta>
                  <NavigationList.Subtitle>
                    {issue.file}:{issue.line_start}
                  </NavigationList.Subtitle>
                </NavigationList.Meta>
              </NavigationList.Item>
            );
          })}
        </NavigationList>
        {issues.length === 0 && (
          <EmptyState variant="inline" size="sm">No issues match filter</EmptyState>
        )}
      </div>
    </div>
  );
}
