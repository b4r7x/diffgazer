import { formatDuration, formatRunId } from "@diffgazer/core/format";
import type {
  AnalysisStats,
  CategoryStats,
  IssuePreview,
  SeverityCounts,
} from "@diffgazer/core/schemas/presentation";
import { pluralize } from "@diffgazer/core/strings";
import { Panel, PanelContent } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBreakdown } from "@/components/shared/severity/breakdown";
import { CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

export interface ReviewCompleteSummaryProps {
  stats: AnalysisStats;
  severityCounts: SeverityCounts;
  categoryStats: CategoryStats[];
  topIssues: IssuePreview[];
  durationMs?: number;
  className?: string;
}

/**
 * The one fact line the run earns: counts and elapsed time, separated by the
 * middle dot the rest of the app already uses. A clean run says so in words
 * instead of filling the template with zeros.
 */
function buildFactLine(stats: AnalysisStats, durationMs: number | undefined): string {
  const elapsed = durationMs === undefined ? "" : ` · ${formatDuration(durationMs)}`;
  if (stats.totalIssues === 0) return `No issues found${elapsed}`;
  return `${pluralize(stats.totalIssues, "issue")} in ${pluralize(stats.filesWithIssues, "file")}${elapsed}`;
}

export function ReviewCompleteSummary({
  stats,
  severityCounts,
  categoryStats,
  topIssues,
  durationMs,
  className,
}: ReviewCompleteSummaryProps) {
  const runLabel = stats.runId ? formatRunId(stats.runId) : "#unknown";
  const isClean = stats.totalIssues === 0;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Panel frame="rail" tone="success" className="py-2 pl-5">
        {/* The run headline stays at terminal scale below sm: at display size it
            wraps to two lines at 375 and dwarfs the panels underneath it. */}
        <Typography as="h1" size="lg" className="text-success-text mb-2 sm:text-2xl">
          Review Complete {runLabel}
        </Typography>
        <p className={cn("text-sm", isClean ? "text-success-text" : "text-muted-foreground")}>
          {buildFactLine(stats, durationMs)}
        </p>
        {stats.blockerCount > 0 && (
          <p className="mt-1 text-sm font-bold text-error-text">
            {pluralize(stats.blockerCount, "blocker")} found.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Labelled panels, like every other block of information in the app.
            The frames stay at rest: the accent corners belong to the focus
            target, which on this screen is the [View Results] action. */}
        <Panel aria-label="Severity breakdown">
          <Panel.Label variant="border" aria-hidden="true">
            Severity Breakdown
          </Panel.Label>
          <PanelContent spacing="sm">
            {/* A clean run keeps its five zero bars - they carry "we did look at
                all five" - but at reduced weight so the zeros stop competing
                with the headline. */}
            <SeverityBreakdown
              counts={severityCounts}
              className={isClean ? "opacity-55" : undefined}
            />
          </PanelContent>
        </Panel>

        <Panel aria-label="Issues by category">
          <Panel.Label variant="border" aria-hidden="true">
            Issues by Category
          </Panel.Label>
          <PanelContent spacing="sm">
            <CategoryStatsTable categories={categoryStats} />
          </PanelContent>
        </Panel>
      </div>

      {topIssues.length > 0 && (
        <div>
          <SectionHeader as="h2" variant="muted" className="mb-3">
            Top Issues Preview
          </SectionHeader>
          <Panel className="overflow-hidden">
            {topIssues.map((issue) => (
              <IssuePreviewItem
                key={issue.id}
                title={issue.title}
                file={issue.file}
                line={issue.line}
                category={issue.category}
                severity={issue.severity}
              />
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}
