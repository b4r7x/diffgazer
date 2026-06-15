import { calculateSeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { isListNavigationKey } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent, Ref } from "react";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";
import { type SeverityFilter, SeverityFilterGroup } from "./severity-filter-group";

interface IssueListState {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedIssueId: string | null;
  highlightedIssueId?: string | null;
}

interface IssueListCallbacks {
  onSelectIssue: (id: string) => void;
  onHighlightIssue?: (id: string | null) => void;
  onListBoundaryReached?: (direction: "previous" | "next") => void;
  onListFocus?: () => void;
}

interface IssueListFilter {
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (filter: SeverityFilter) => void;
  onSeverityFilterReset?: () => void;
  onSeverityFilterBoundary?: (direction: "previous" | "next") => void;
  focusedFilterIndex?: number;
  onFocusedFilterIndexChange?: (index: number) => void;
  isFilterFocused?: boolean;
  onFilterKeyDown?: (event: KeyboardEvent) => void;
}

interface IssueListRefs {
  filterRef?: Ref<HTMLDivElement>;
  listRef?: Ref<HTMLDivElement>;
}

interface IssueListUi {
  isFocused: boolean;
  title?: string;
  className?: string;
}

export interface IssueListPaneProps {
  listState: IssueListState;
  callbacks: IssueListCallbacks;
  filter: IssueListFilter;
  refs: IssueListRefs;
  ui: IssueListUi;
}

export function IssueListPane({
  listState: { issues, allIssues, selectedIssueId, highlightedIssueId },
  callbacks: { onSelectIssue, onHighlightIssue, onListBoundaryReached, onListFocus },
  filter: {
    severityFilter,
    onSeverityFilterChange,
    onSeverityFilterReset,
    onSeverityFilterBoundary,
    focusedFilterIndex,
    onFocusedFilterIndexChange,
    isFilterFocused,
    onFilterKeyDown,
  },
  refs: { filterRef, listRef },
  ui: { isFocused, title = "Issues", className },
}: IssueListPaneProps) {
  const counts = calculateSeverityCounts(allIssues);
  const isFilterActive = severityFilter.size > 0;
  let emptyMessage = "No issues match filter";
  if (allIssues.length === 0) {
    emptyMessage = "No issues found";
  } else if (isFilterActive) {
    emptyMessage = "No issues match the current filters — press [Reset] to clear";
  }
  // The severity filter visually lives inside this pane, so the pane
  // keeps its focus outline while either zone is active.
  const isPaneFocused = isFocused || !!isFilterFocused;

  return (
    <Panel
      as="aside"
      aria-label="Issue list"
      data-pane="list"
      data-focused={isPaneFocused || undefined}
      className={cn(
        "w-2/5 flex flex-col min-h-0 overflow-hidden border border-border data-[focused]:border-info",
        className,
      )}
    >
      <div className="px-3 pb-4 pt-2">
        <div className="text-accent font-bold mb-2">{title}</div>
        <SeverityFilterGroup
          counts={counts}
          activeFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          onReset={onSeverityFilterReset}
          onNavigationBoundaryReached={onSeverityFilterBoundary}
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
              return;
            }
            // With an empty list the auto-focused listbox swallows ArrowUp before
            // it can reach the zone-escape, so steer the boundary up to the filters
            // here, ahead of the listbox's own navigation handler.
            if (
              isFocused &&
              issues.length === 0 &&
              (event.key === "ArrowUp" || event.key === "k")
            ) {
              event.preventDefault();
              onListBoundaryReached?.("previous");
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
            const config = SEVERITY_CONFIG[issue.severity];
            return (
              <NavigationList.Item
                key={issue.id}
                id={issue.id}
                density="compact"
                className={cn(
                  "border-b border-border last:border-b-0",
                  !isFocused && selectedIssueId === issue.id && "border-l-2 border-l-info/60",
                )}
              >
                <NavigationList.Title className="min-w-0">
                  <span className="sr-only">{issue.severity} severity: </span>
                  <span
                    className={cn(
                      "mr-2",
                      config.color,
                      "group-data-[highlighted]:text-primary-foreground",
                    )}
                    aria-hidden="true"
                  >
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
          <EmptyState variant="inline" size="sm" live>
            {emptyMessage}
          </EmptyState>
        )}
      </div>
    </Panel>
  );
}
