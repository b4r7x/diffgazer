import { cn } from "@/utils/cn";
import { SectionHeader } from "@/components/ui/section-header";
import { SeverityBreakdown } from "@/components/ui/severity/severity-breakdown";
import type { ReviewIssue } from "@stargazer/schemas/review";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";
import type { SeverityCounts } from "@stargazer/schemas/ui";
import { capitalize } from "@stargazer/core/strings";

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
      <div className={cn("flex items-center justify-center text-gray-500 text-sm", className)}>
        Select a run to view insights
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 text-xs text-gray-500 font-bold border-b border-tui-border">
        <span className="uppercase tracking-wider">Insights: Run</span> {runId}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Severity Breakdown */}
        {severityCounts && (
          <div>
            <SectionHeader className="border-b border-gray-800 pb-1">
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
            <SectionHeader className="border-b border-gray-800 pb-1">
              {issues.length} Issues
            </SectionHeader>
            <div className="space-y-3 mt-3">
              {issues.map((issue) => (
                <div key={issue.id} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className={cn("font-bold", SEVERITY_CONFIG[issue.severity].color)}>
                      [{capitalize(issue.severity)}]
                    </span>
                    <span className="text-gray-600 font-mono">L:{issue.line_start}</span>
                  </div>
                  <p
                    className="text-gray-400 truncate cursor-pointer hover:text-tui-fg"
                    onClick={() => onIssueClick?.(issue.id)}
                  >
                    {issue.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Duration footer */}
      {duration && (
        <div className="border-t border-tui-border p-3 bg-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Duration</div>
          <div className="text-sm font-mono text-tui-fg">{duration}</div>
        </div>
      )}
    </div>
  );
}
