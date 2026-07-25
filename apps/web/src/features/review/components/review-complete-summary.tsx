import { formatDuration } from "@diffgazer/core/format";
import { formatRunId } from "@diffgazer/core/review";
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

export function ReviewCompleteSummary({
  stats,
  severityCounts,
  categoryStats,
  topIssues,
  durationMs,
  className,
}: ReviewCompleteSummaryProps) {
  const runLabel = stats.runId ? formatRunId(stats.runId) : "#unknown";

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Panel frame="rail" tone="success" className="py-2 pl-5">
        {/* The run headline stays at terminal scale below sm: at display size it
            wraps to two lines at 375 and dwarfs the panels underneath it. */}
        <Typography as="h1" size="lg" className="text-success-text mb-2 sm:text-2xl">
          Review Complete {runLabel}
        </Typography>
        <p className="text-sm text-muted-foreground">
          Found{" "}
          <span className="text-foreground font-bold">{pluralize(stats.totalIssues, "issue")}</span>{" "}
          across{" "}
          <span className="text-foreground font-bold">
            {pluralize(stats.filesWithIssues, "file")} with issues
          </span>
          .
          {stats.blockerCount > 0 && (
            <>
              {" "}
              <span className="text-error-text font-bold">
                {pluralize(stats.blockerCount, "blocker")} found
              </span>
              .
            </>
          )}
        </p>
        {durationMs !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Duration: <span className="text-foreground">{formatDuration(durationMs)}</span>
          </p>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel frame="surface">
          <PanelContent spacing="sm">
            <SectionHeader as="h2" variant="muted">
              Severity Breakdown
            </SectionHeader>
            <SeverityBreakdown counts={severityCounts} />
          </PanelContent>
        </Panel>

        <Panel frame="surface">
          <PanelContent spacing="sm">
            <SectionHeader as="h2" variant="muted">
              Issues by Category
            </SectionHeader>
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
