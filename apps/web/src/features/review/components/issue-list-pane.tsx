import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import { calculateSeverityCounts, type ReviewIssue } from "@diffgazer/core/schemas/review";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { cn } from "@diffgazer/ui/lib/utils";
import type { Ref } from "react";
import { PathValue } from "@/components/shared/path-value";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { SeverityFilterGroup, type SeverityFilterGroupProps } from "./severity-filter-group";

/**
 * The severity filter row is the pane's, but its state belongs to whoever owns
 * the review keyboard. It travels as one cluster so a new filter affordance is
 * added to SeverityFilterGroup alone, not to every layer that forwards it. The
 * pane derives `counts` from `allIssues` and owns the row's layout.
 */
type IssueListFilter = Omit<SeverityFilterGroupProps, "counts" | "className">;

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedIssueId: string | null;
  highlightedIssueId?: string | null;
  onSelectIssue: (id: string) => void;
  onHighlightIssue?: (id: string | null) => void;
  onListBoundaryReached?: (direction: "previous" | "next") => void;
  onListFocus?: () => void;
  filter: IssueListFilter;
  listRef?: Ref<HTMLDivElement>;
  listBodyRef?: Ref<HTMLDivElement>;
  isFocused: boolean;
  title?: string;
  className?: string;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedIssueId,
  highlightedIssueId,
  onSelectIssue,
  onHighlightIssue,
  onListBoundaryReached,
  onListFocus,
  filter,
  listRef,
  listBodyRef,
  isFocused,
  title = "Issues",
  className,
}: IssueListPaneProps) {
  // The severity filter and the list both live inside this pane, so tracking
  // focus on the pane root covers either zone without a second flag.
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLElement>();
  const counts = calculateSeverityCounts(allIssues);
  const isFilterActive = filter.activeFilter.size > 0;
  let emptyMessage = "No issues match filter";
  if (allIssues.length === 0) {
    emptyMessage = "No issues found";
  } else if (isFilterActive) {
    emptyMessage = "No issues match the current filters — press [Reset] to clear";
  }

  return (
    <Panel
      as="aside"
      {...focusProps}
      aria-label="Issue list"
      data-pane="list"
      focused={focusWithin}
      className={cn(
        "mt-3 flex min-h-0 w-full flex-1 flex-col md:w-2/5 md:flex-initial md:basis-auto",
        className,
      )}
    >
      <Panel.Label variant="border" aria-hidden="true">
        {title} · {allIssues.length}
      </Panel.Label>
      <div className="px-3 pb-4 pt-3">
        <SeverityFilterGroup counts={counts} {...filter} />
      </div>

      <ScrollArea ref={listBodyRef} data-list-body="" className="flex min-w-0 flex-1 flex-col">
        <NavigationList
          ref={listRef}
          aria-label={title}
          selectedId={selectedIssueId}
          highlighted={highlightedIssueId}
          onFocus={onListFocus}
          onKeyDown={(event) => {
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
          // The pane clips at its own border, so the list keeps a bottom gutter:
          // scrolled to the end, the last row lands clear of the edge instead of
          // sitting half-cut against it.
          className="space-y-1 pb-2"
        >
          {issues.map((issue) => {
            const config = SEVERITY_CONFIG[issue.severity];
            const location =
              issue.line_start == null ? issue.file : `${issue.file}:${issue.line_start}`;
            return (
              <NavigationList.Item
                key={issue.id}
                id={issue.id}
                density="compact"
                className="border-b border-border/50 last:border-b-0"
              >
                {/* pe-3 is the gutter between the title cell and the severity
                    tag beside it: the row grid has no column gap, so a title
                    that fills its track put "…magic paddingLOW" on one line. */}
                <NavigationList.Title className="min-w-0 items-start pe-3">
                  {/* The tag below sits in the Status slot, which is wired into
                      neither the option's name nor its description, so the
                      severity still reaches AT exactly once through here. */}
                  <span className="sr-only">{issue.severity} severity: </span>
                  {/* Rank mark for the at-a-glance scan down the column. It is
                      hidden from AT because the prefix above already carries the
                      severity, and a glyph would announce it a second time. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mr-1.5 shrink-0",
                      config.color,
                      "group-data-[highlighted]:text-primary-foreground",
                    )}
                  >
                    {config.glyph}
                  </span>
                  {/* One line at desktop pitch so every row is the same height;
                      below md the title gets a second line instead of a harder
                      truncation on a narrow column. */}
                  <span className="min-w-0 line-clamp-1 max-md:line-clamp-2">{issue.title}</span>
                </NavigationList.Title>
                {/* The word stays beside the glyph rather than being replaced by
                    it: shape and colour alone are not decodable, and this is the
                    same form the history insights pane uses. */}
                <NavigationList.Status
                  className={cn(
                    "tracking-[0.08em] tabular-nums",
                    config.color,
                    "group-data-[highlighted]:text-primary-foreground",
                  )}
                >
                  {SEVERITY_LABELS[issue.severity]}
                </NavigationList.Status>
                <NavigationList.Meta className="min-w-0 overflow-hidden">
                  {/* PathValue owns the truncation here, so the subtitle's own
                      `truncate` is neutralised down to its clipping box: the
                      ellipsis has to land on the directory, not on the filename. */}
                  <NavigationList.Subtitle className="whitespace-normal text-clip">
                    <PathValue value={location} />
                  </NavigationList.Subtitle>
                </NavigationList.Meta>
              </NavigationList.Item>
            );
          })}
        </NavigationList>
        <EmptyState live className={issues.length > 0 ? "sr-only p-0" : "flex-1"}>
          {issues.length === 0 ? emptyMessage : null}
        </EmptyState>
      </ScrollArea>
    </Panel>
  );
}
