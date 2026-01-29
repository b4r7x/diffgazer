import { cn } from "@/lib/utils";
import { Panel, PanelHeader, PanelContent, SeverityBar, Badge, IssuePreviewItem, type SeverityLevel } from "@/components/ui";
import { SectionHeader } from "@/components/ui/section-header";
import type { TriageIssue } from "@repo/schemas";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: Record<SeverityLevel, number>;
  topLenses: string[];
  topIssues: TriageIssue[];
  duration?: string;
  onIssueClick?: (issueId: string) => void;
  className?: string;
}

const SEVERITY_ORDER: SeverityLevel[] = ["blocker", "high", "medium", "low"];

export function HistoryInsightsPane({
  runId,
  severityCounts,
  topLenses,
  topIssues,
  duration,
  onIssueClick,
  className,
}: HistoryInsightsPaneProps) {
  const maxCount = Math.max(...Object.values(severityCounts), 1);

  if (!runId) {
    return (
      <div className={cn("flex items-center justify-center text-gray-500 text-sm", className)}>
        Select a run to view insights
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border">
        Insights: Run {runId}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Severity Histogram */}
        <div>
          <SectionHeader className="border-b border-gray-800 pb-1">
            Severity Histogram
          </SectionHeader>
          <div className="space-y-2 mt-3">
            {SEVERITY_ORDER.map((severity) => (
              <SeverityBar
                key={severity}
                label={severity.charAt(0).toUpperCase() + severity.slice(1)}
                count={severityCounts[severity] ?? 0}
                max={maxCount}
                severity={severity}
              />
            ))}
          </div>
        </div>

        {/* Top Lenses */}
        {topLenses.length > 0 && (
          <div>
            <SectionHeader className="border-b border-gray-800 pb-1">
              Top Lenses
            </SectionHeader>
            <div className="flex flex-wrap gap-2 mt-3">
              {topLenses.map((lens) => (
                <Badge key={lens} variant="neutral" size="sm">
                  {lens}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Top Issues */}
        {topIssues.length > 0 && (
          <div>
            <SectionHeader className="border-b border-gray-800 pb-1">
              Top {topIssues.length} Issues
            </SectionHeader>
            <div className="space-y-3 mt-3">
              {topIssues.map((issue) => (
                <div key={issue.id} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className={cn(
                      "font-bold",
                      issue.severity === "blocker" && "text-tui-red",
                      issue.severity === "high" && "text-tui-yellow",
                      issue.severity === "medium" && "text-gray-400",
                      issue.severity === "low" && "text-tui-blue"
                    )}>
                      [{issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}]
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
