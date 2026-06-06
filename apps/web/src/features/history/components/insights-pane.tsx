import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { capitalize } from "@diffgazer/core/strings";
import { isListNavigationKey } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent, Ref } from "react";
import { SeverityBreakdown } from "@/components/ui/severity/breakdown";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  duration?: string;
  highlightedIssueId?: string | null;
  isFocused?: boolean;
  listRef?: Ref<HTMLDivElement>;
  onSelectIssue?: (id: string) => void;
  onHighlightIssue?: (id: string | null) => void;
  onListBoundaryReached?: (direction: "previous" | "next") => void;
  onListFocus?: () => void;
  className?: string;
}

export function HistoryInsightsPane({
  runId,
  severityCounts,
  issues,
  duration,
  highlightedIssueId = null,
  isFocused = false,
  listRef,
  onSelectIssue,
  onHighlightIssue,
  onListBoundaryReached,
  onListFocus,
  className,
}: HistoryInsightsPaneProps) {
  if (!runId) {
    return (
      <EmptyState className={className}>
        Select a run to view insights
      </EmptyState>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <SectionHeader as="h2" variant="muted" bordered className="mb-0 p-3 border-tui-border">
        Insights: Run {runId}
      </SectionHeader>

      <ScrollArea className="flex-1 min-h-0 p-4 pr-2 space-y-6">
        {severityCounts && (
          <div>
            <SectionHeader bordered className="border-tui-border">
              Severity Breakdown
            </SectionHeader>
            <div className="mt-3">
              <SeverityBreakdown counts={severityCounts} />
            </div>
          </div>
        )}

        {issues.length > 0 && (
          <div>
            <SectionHeader bordered className="border-tui-border">
              {issues.length} Issues
            </SectionHeader>
            <NavigationList
              ref={listRef}
              aria-label="Run issues"
              highlighted={highlightedIssueId}
              onFocus={onListFocus}
              onEnter={(id) => onSelectIssue?.(id)}
              onSelect={(id) => onSelectIssue?.(id)}
              onHighlightChange={onHighlightIssue}
              onNavigationBoundaryReached={(direction) => onListBoundaryReached?.(direction)}
              onKeyDown={(event: KeyboardEvent) => {
                if (!isFocused && isListNavigationKey(event.key)) {
                  event.preventDefault();
                }
              }}
              focused={isFocused}
              wrap={false}
              className="mt-3"
            >
              {issues.map((issue) => (
                <NavigationList.Item
                  key={issue.id}
                  id={issue.id}
                  density="compact"
                  className="border-b border-tui-border last:border-b-0"
                >
                  <NavigationList.Title className="min-w-0">
                    <span
                      className={cn(
                        "mr-2 font-bold",
                        SEVERITY_CONFIG[issue.severity].color,
                        "group-data-[active]:text-primary-foreground",
                      )}
                    >
                      [{capitalize(issue.severity)}]
                    </span>
                    <span className="min-w-0 truncate">{issue.title}</span>
                  </NavigationList.Title>
                  <NavigationList.Meta>
                    <NavigationList.Subtitle>L:{issue.line_start}</NavigationList.Subtitle>
                  </NavigationList.Meta>
                </NavigationList.Item>
              ))}
            </NavigationList>
          </div>
        )}
      </ScrollArea>

      {duration && (
        <div className="border-t border-tui-border p-3 bg-tui-selection/10">
          <div className="text-2xs text-tui-muted uppercase tracking-wider mb-1">Duration</div>
          <div className="text-sm font-mono text-tui-fg">{duration}</div>
        </div>
      )}
    </div>
  );
}
