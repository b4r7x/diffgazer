import { pluralize } from "@diffgazer/core/strings";
import { isListNavigationKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import type { Ref } from "react";
import type { Run } from "@/features/history/types";

export interface HistoryRunsPaneProps {
  runs: Run[];
  selectedRunId: string | null;
  /** Runs whose stored issue records this build could not decode at read time. */
  droppedIssueRunIds: ReadonlySet<string>;
  emptyRunsMessage: string;
  hasSearchQuery: boolean;
  hasMoreReviews: boolean;
  isLoadingMoreReviews: boolean;
  /** Set when the last "load older runs" attempt failed. */
  loadMoreError: string | null;
  isFocused: boolean;
  listRef?: Ref<HTMLDivElement>;
  loadMoreRef?: Ref<HTMLButtonElement>;
  onSelect: (runId: string) => void;
  onActivate: (runId: string) => void;
  onHighlightChange: (runId: string | null) => void;
  onBoundaryReached: (direction: "previous" | "next") => void;
  onFocus: () => void;
  onLoadMore: () => void;
}

export function HistoryRunsPane({
  runs,
  selectedRunId,
  droppedIssueRunIds,
  emptyRunsMessage,
  hasSearchQuery,
  hasMoreReviews,
  isLoadingMoreReviews,
  loadMoreError,
  isFocused,
  listRef,
  loadMoreRef,
  onSelect,
  onActivate,
  onHighlightChange,
  onBoundaryReached,
  onFocus,
  onLoadMore,
}: HistoryRunsPaneProps) {
  return (
    // Full-bleed like SECTIONS: the highlighted row fill and every
    // border-b rule span border-to-border, TUI-style.
    <ScrollArea overlay className="pl-[2px] pb-2 md:min-h-0 md:flex-1">
      {runs.length > 0 ? (
        <NavigationList
          ref={listRef}
          aria-label="Review runs"
          selectedId={selectedRunId}
          highlighted={isFocused ? selectedRunId : null}
          onFocus={onFocus}
          onSelect={onSelect}
          onEnter={onActivate}
          onHighlightChange={onHighlightChange}
          onNavigationBoundaryReached={onBoundaryReached}
          // Space is deliberately absent: NavigationList already routes it to onSelect.
          onKeyDown={(event) => {
            if (!isFocused && isListNavigationKey(event.key)) event.preventDefault();
          }}
          wrap={false}
          focused={isFocused}
          // "/" and o are window-level shortcuts for this zone; list
          // typeahead would claim those keystrokes before they arrive.
          typeahead={false}
        >
          {runs.map((run) => (
            <NavigationList.Item
              key={run.id}
              id={run.id}
              className="border-b border-b-border last:border-b-0"
            >
              <NavigationList.Title>{run.displayId}</NavigationList.Title>
              <NavigationList.Status className="text-muted-foreground group-data-[highlighted]:text-primary-foreground/70">
                {run.timestamp}
              </NavigationList.Status>
              {/* flex-wrap plus the summary's min-w-full stack the branch
                  chip and summary on their own lines, so a run reads as
                  three lines and the list fills the pane. The indent (glyph
                  advance 1ch + its mr-2) left-aligns rows 2-3 with the
                  run-id text above. */}
              <NavigationList.Meta className="min-w-0 flex-wrap pl-[calc(1ch+0.5rem)]">
                <NavigationList.Badge variant="neutral" size="sm">
                  {run.branch}
                </NavigationList.Badge>
                {droppedIssueRunIds.has(run.id) ? (
                  <NavigationList.Badge variant="warning" size="sm">
                    Issues omitted
                  </NavigationList.Badge>
                ) : null}
                <span className="min-w-full line-clamp-2 text-sm text-muted-foreground group-data-[highlighted]:text-primary-foreground/85">
                  {run.summary}
                </span>
              </NavigationList.Meta>
            </NavigationList.Item>
          ))}
        </NavigationList>
      ) : null}
      {/* The list ends well above the pane floor on a short history; the
          marker names that void as the end of the runs rather than
          inflating the cards to fill it. */}
      {runs.length > 0 ? (
        <p className="mt-6 text-center text-2xs text-muted-foreground">
          ── {pluralize(runs.length, "run")} ──
        </p>
      ) : null}
      {/* Live region stays mounted across the runs→empty transition so the
          empty message is announced; empty (and collapsed) while runs exist. */}
      <EmptyState
        variant="inline"
        size="sm"
        live
        className={runs.length === 0 ? "h-full flex-col gap-1" : "p-0"}
      >
        {runs.length === 0 ? <EmptyState.Message>{emptyRunsMessage}</EmptyState.Message> : null}
        {/* Only a search has a key to press: the "no runs yet" and
            date-filtered empties stay honest with no hint. Hidden below sm
            because a phone has no Esc — mobile clears with the input. */}
        {runs.length === 0 && hasSearchQuery ? (
          <EmptyState.Hint className="max-sm:hidden">
            <Kbd size="sm">Esc</Kbd> clear search
          </EmptyState.Hint>
        ) : null}
      </EmptyState>
      {hasMoreReviews ? (
        // The list is full-bleed, so the button re-insets itself: a
        // border-to-border control would read as another run row.
        <div className="space-y-2 px-2 pt-2">
          {loadMoreError ? (
            <p className="text-center text-2xs text-error-text">
              Could not load older runs. {loadMoreError}
            </p>
          ) : null}
          <Button
            ref={loadMoreRef}
            variant="outline"
            size="sm"
            bracket
            loading={isLoadingMoreReviews}
            onClick={onLoadMore}
            className="w-full"
          >
            Load older runs
          </Button>
        </div>
      ) : null}
    </ScrollArea>
  );
}
