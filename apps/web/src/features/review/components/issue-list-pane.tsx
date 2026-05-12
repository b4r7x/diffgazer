import type { KeyboardEvent, Ref } from "react";
import { cn } from "@diffgazer/core/cn";
import { SeverityFilterGroup, type SeverityFilter } from "./severity-filter-group";
import { calculateSeverityCounts } from "@diffgazer/core/schemas/ui";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Panel } from "@diffgazer/ui/components/panel";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";
import { isListNavigationKey } from "@diffgazer/keys";

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onHighlightIssue?: (id: string | null) => void;
  onListBoundaryReached?: (direction: "previous" | "next") => void;
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (filter: SeverityFilter) => void;
  isFocused: boolean;
  isFilterFocused?: boolean;
  focusedFilterIndex?: number;
  onFocusedFilterIndexChange?: (index: number) => void;
  filterRef?: Ref<HTMLDivElement>;
  onFilterKeyDown?: (event: KeyboardEvent) => void;
  highlightedIssueId?: string | null;
  onListFocus?: () => void;
  listRef?: Ref<HTMLDivElement>;
  title?: string;
  className?: string;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedIssueId,
  onSelectIssue,
  onHighlightIssue,
  onListBoundaryReached,
  severityFilter,
  onSeverityFilterChange,
  isFocused,
  isFilterFocused,
  focusedFilterIndex,
  onFocusedFilterIndexChange,
  filterRef,
  onFilterKeyDown,
  highlightedIssueId,
  onListFocus,
  listRef,
  title = "Analysis",
  className,
}: IssueListPaneProps) {
  const counts = calculateSeverityCounts(allIssues);
  const emptyMessage = allIssues.length === 0 ? "No issues found" : "No issues match filter";
  // The severity filter visually lives inside this pane, so the pane
  // keeps its focus outline while either zone is active.
  const isPaneFocused = isFocused || !!isFilterFocused;

  return (
    <Panel
      as="aside"
      aria-label="Issue list"
      variant="borderless"
      data-pane="list"
      data-focused={isPaneFocused || undefined}
      className={cn(
        "w-2/5 flex flex-col min-h-0 overflow-hidden border border-tui-border data-[focused]:border-tui-blue",
        className,
      )}
    >
      <div className="px-3 pb-4 pt-2">
        <div className="text-tui-violet font-bold mb-2">{title}</div>
        <SeverityFilterGroup
          counts={counts}
          activeFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          isFocused={isFilterFocused}
          focusedIndex={focusedFilterIndex}
          onFocusedIndexChange={onFocusedFilterIndexChange}
          ref={filterRef}
          onKeyDown={(event) => {
            onFilterKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (!isFilterFocused) event.preventDefault();
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <NavigationList
          ref={listRef}
          aria-label={title}
          selectedId={selectedIssueId}
          highlighted={highlightedIssueId}
          onFocus={onListFocus}
          onKeyDown={(event) => {
            if (!isFocused && isListNavigationKey(event.key)) {
              event.preventDefault();
            }
          }}
          onSelect={onSelectIssue}
          onHighlightChange={onHighlightIssue}
          onNavigationBoundaryReached={(direction) => onListBoundaryReached?.(direction)}
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
                className={cn(
                  "border-b border-tui-border last:border-b-0",
                  !isFocused && selectedIssueId === issue.id && "border-l-2 border-l-tui-blue/60",
                )}
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
          <EmptyState variant="inline" size="sm">{emptyMessage}</EmptyState>
        )}
      </div>
    </Panel>
  );
}
