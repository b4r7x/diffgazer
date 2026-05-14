import { cn } from "@diffgazer/ui/lib/utils";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Button } from "@diffgazer/ui/components/button";
import { SeverityBreakdown } from "@/components/ui/severity/severity-breakdown";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";
import type { SeverityCounts } from "@diffgazer/core/schemas/ui";
import { capitalize } from "@diffgazer/core/strings";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  duration?: string;
  onIssueClick?: (issueId: string) => void;
  className?: string;
}

export function HistoryInsightsPane({
  runId,
  severityCounts,
  issues,
  duration,
  onIssueClick,
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
            <div className="space-y-3 mt-3">
              {issues.map((issue) => (
                <div key={issue.id} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className={cn("font-bold", SEVERITY_CONFIG[issue.severity].color)}>
                      [{capitalize(issue.severity)}]
                    </span>
                    <span className="text-tui-muted font-mono">L:{issue.line_start}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto justify-start px-0 py-0 text-tui-muted truncate hover:text-tui-fg text-left w-full"
                    onClick={() => onIssueClick?.(issue.id)}
                  >
                    {issue.title}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {duration && (
        <div className="border-t border-tui-border p-3 bg-tui-selection/10">
          <div className="text-[10px] text-tui-muted uppercase tracking-wider mb-1">Duration</div>
          <div className="text-sm font-mono text-tui-fg">{duration}</div>
        </div>
      )}
    </div>
  );
}
