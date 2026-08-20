import { formatDuration, formatRunId } from "@diffgazer/core/format";
import type { CategoryStats } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, SeverityCounts } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBreakdown } from "@/components/shared/severity/breakdown";
import { CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

interface AnalysisStats {
  runId: string | null;
  totalIssues: number;
  filesWithIssues: number;
  blockerCount: number;
}

type IssuePreview = Pick<ReviewIssue, "id" | "title" | "file" | "category" | "severity"> & {
  line?: ReviewIssue["line_start"];
};

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
  const hasCategories = categoryStats.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* tone repaints border-color only, so the corner chip - which tracks the
          enclosure through --panel-border-color - would keep the neutral edge;
          lifting --panel-border puts chip and frame on the same green. */}
      <Panel
        tone="success"
        aria-label="Run status"
        className="[--panel-border:var(--success-border)]"
      >
        <Panel.Label variant="border" aria-hidden="true">
          Run Status
        </Panel.Label>
        <Panel.Content spacing="none">
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
        </Panel.Content>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Labelled panels, like every other block of information in the app.
            The frames stay at rest: the single reticle belongs to the page
            panel enclosing the summary, claimed while focus sits inside it. */}
        <Panel aria-label="Severity breakdown">
          <Panel.Label variant="border" aria-hidden="true">
            Severity Breakdown
          </Panel.Label>
          <Panel.Content spacing="sm">
            {/* A clean run keeps its five zero bars - they carry "we did look at
                all five" - but at reduced weight so the zeros stop competing
                with the headline. */}
            <SeverityBreakdown
              counts={severityCounts}
              className={isClean ? "opacity-55" : undefined}
            />
          </Panel.Content>
        </Panel>

        {/* A clean run has nothing to tabulate, so the panel leaves the two-column
            pairing and says so across the whole row: stretched to a half-width
            column it read as a box with a lost sentence in it. */}
        <Panel
          aria-label="Issues by category"
          className={hasCategories ? undefined : "col-span-full"}
        >
          <Panel.Label variant="border" aria-hidden="true">
            Issues by Category
          </Panel.Label>
          <Panel.Content spacing="sm">
            <CategoryStatsTable categories={categoryStats} />
          </Panel.Content>
        </Panel>
      </div>

      {topIssues.length > 0 && (
        <Panel aria-label="Top Issues Preview">
          <Panel.Label variant="border" aria-hidden="true">
            Top Issues Preview
          </Panel.Label>
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
      )}
    </div>
  );
}
