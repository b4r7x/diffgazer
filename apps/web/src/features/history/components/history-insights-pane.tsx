import { cn } from "@/utils/cn";
import { ScrollArea, SectionHeader } from "@diffgazer/ui";
import { SeverityBreakdown } from "@/components/ui/severity/severity-breakdown";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";
import type { SeverityCounts } from "@diffgazer/schemas/ui";
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
      <div className={cn("flex items-center justify-center text-tui-muted text-sm", className)}>
        Select a run to view insights
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="p-3 text-xs text-tui-muted font-bold border-b border-tui-border">
        <span className="uppercase tracking-wider">Insights: Run</span> {runId}
      </div>

      <ScrollArea className="flex-1 min-h-0 p-4 pr-2 space-y-6">
        {/* Severity Breakdown */}
        {severityCounts && (
          <div>
            <SectionHeader className="border-b border-tui-border pb-1">
              Severity Breakdown
            </SectionHeader>
            <div className="mt-3">
              <SeverityBreakdown counts={severityCounts} />
            </div>
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div>
            <SectionHeader className="border-b border-tui-border pb-1">
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
                  <button
                    type="button"
                    className="text-tui-muted truncate cursor-pointer hover:text-tui-fg text-left w-full"
                    onClick={() => onIssueClick?.(issue.id)}
                  >
                    {issue.title}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Duration footer */}
      {duration && (
        <div className="border-t border-tui-border p-3 bg-tui-selection/10">
          <div className="text-[10px] text-tui-muted uppercase tracking-wider mb-1">Duration</div>
          <div className="text-sm font-mono text-tui-fg">{duration}</div>
        </div>
      )}
    </div>
  );
}
