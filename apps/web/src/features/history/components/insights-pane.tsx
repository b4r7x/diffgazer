import type { HistoryDetailState } from "@diffgazer/core/review";
import type { ReviewIssue, SeverityCounts } from "@diffgazer/core/schemas/review";
import { capitalize } from "@diffgazer/core/strings";
import { isListNavigationKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent, Ref } from "react";
import { SeverityBreakdown } from "@/components/shared/severity/breakdown";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  detailState?: HistoryDetailState;
  duration?: string;
  highlightedIssueId?: string | null;
  isFocused?: boolean;
  listRef?: Ref<HTMLDivElement>;
  retryRef?: Ref<HTMLButtonElement>;
  onSelectIssue?: (id: string) => void;
  onHighlightIssue?: (id: string | null) => void;
  onListBoundaryReached?: (direction: "previous" | "next") => void;
  onListFocus?: () => void;
  className?: string;
}

// A bare line number identifies nothing; the rail has room for the file name that
// owns it. The directory is dropped rather than truncated so the datum stays whole.
function formatIssueLocation(issue: ReviewIssue): string {
  const fileName = issue.file.split("/").pop() ?? issue.file;
  return issue.line_start == null ? fileName : `${fileName}:${issue.line_start}`;
}

export function HistoryInsightsPane({
  runId,
  severityCounts,
  issues,
  detailState = { status: "ready" },
  duration,
  highlightedIssueId = null,
  isFocused = false,
  listRef,
  retryRef,
  onSelectIssue,
  onHighlightIssue,
  onListBoundaryReached,
  onListFocus,
  className,
}: HistoryInsightsPaneProps) {
  if (!runId) {
    return (
      <EmptyState className={cn("flex-1", className)}>Select a run to view insights</EmptyState>
    );
  }

  return (
    // Below md the pane is stacked in a scrolling column, so the issue list and
    // the duration footer both take their natural height; from md up the pane is
    // a fixed-height track and only the list scrolls.
    <div className={cn("flex flex-col md:h-full md:min-h-0 md:overflow-hidden", className)}>
      <ScrollArea className="space-y-6 overflow-visible px-4 pt-3 pb-4 md:min-h-0 md:flex-1 md:overflow-x-hidden md:overflow-y-auto">
        {severityCounts && (
          <div>
            <SectionHeader as="h3" bordered>
              Severity Breakdown
            </SectionHeader>
            <div className="mt-3">
              <SeverityBreakdown counts={severityCounts} />
            </div>
          </div>
        )}

        {detailState.status === "loading" ? (
          <output className="text-sm text-muted-foreground">Loading review details...</output>
        ) : null}

        {detailState.status === "error" ? (
          <div role="alert" className="space-y-3 text-sm text-error-text">
            <p>Could not load review details: {detailState.message}</p>
            <Button ref={retryRef} size="sm" variant="secondary" onClick={detailState.retry}>
              Retry
            </Button>
          </div>
        ) : null}

        {detailState.status === "ready" && issues.length > 0 && (
          <div>
            <SectionHeader as="h3" bordered>
              {issues.length} Issues
            </SectionHeader>
            <NavigationList
              ref={listRef}
              aria-label="Run issues"
              highlighted={highlightedIssueId}
              onFocus={onListFocus}
              onEnter={(id) => onSelectIssue?.(id)}
              onHighlightChange={onHighlightIssue}
              onNavigationBoundaryReached={(direction) => onListBoundaryReached?.(direction)}
              onKeyDown={(event: KeyboardEvent) => {
                if (!isFocused && isListNavigationKey(event.key)) {
                  event.preventDefault();
                }
              }}
              focused={isFocused}
              wrap={false}
              // "/", l, and R are window-level shortcuts for this zone; list
              // typeahead would claim those keystrokes before they arrive.
              typeahead={false}
              className="mt-3"
            >
              {issues.map((issue) => (
                <NavigationList.Item
                  key={issue.id}
                  id={issue.id}
                  onClick={() => onSelectIssue?.(issue.id)}
                  density="compact"
                  className="border-b border-border last:border-b-0 py-1"
                >
                  <NavigationList.Title className="min-w-0 items-start">
                    <span
                      className={cn(
                        "mr-2 font-bold",
                        SEVERITY_CONFIG[issue.severity].color,
                        "group-data-[highlighted]:text-primary-foreground",
                      )}
                    >
                      [{capitalize(issue.severity)}]
                    </span>
                    {/* The title may take up to two lines that align under the
                        title's own start (the tag is a separate flex item, so
                        overflow no longer hangs under it); file:line stays on
                        its own row. */}
                    <span className="min-w-0 line-clamp-2">{issue.title}</span>
                  </NavigationList.Title>
                  {/* Indent (glyph advance 1ch + its mr-2) aligns file:line
                      under the severity tag instead of jutting left under the
                      glyph. */}
                  <NavigationList.Meta className="pl-[calc(1ch+0.5rem)]">
                    <NavigationList.Subtitle>{formatIssueLocation(issue)}</NavigationList.Subtitle>
                  </NavigationList.Meta>
                </NavigationList.Item>
              ))}
            </NavigationList>
          </div>
        )}
      </ScrollArea>

      {duration && (
        <div className="border-t border-border bg-base-surface-1 px-4 py-3">
          <SectionHeader as="h3" variant="muted" className="mb-1">
            Duration
          </SectionHeader>
          <div className="font-mono text-sm text-foreground">{duration}</div>
        </div>
      )}
    </div>
  );
}
