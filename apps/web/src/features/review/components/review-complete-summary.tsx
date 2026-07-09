import { formatRunId } from "@diffgazer/core/review";
import type {
  AnalysisStats,
  IssuePreview,
  SeverityCounts,
} from "@diffgazer/core/schemas/presentation";
import { pluralize } from "@diffgazer/core/strings";
import { Button } from "@diffgazer/ui/components/button";
import { Panel, PanelContent } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBreakdown } from "@/components/shared/severity/breakdown";
import { type CategoryStats, CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

export type { IssuePreview };

export interface ReviewCompleteSummaryProps {
  stats: AnalysisStats;
  severityCounts: SeverityCounts;
  categoryStats: CategoryStats[];
  topIssues: IssuePreview[];
  onEnterReview?: () => void;
  onBack?: () => void;
  className?: string;
}

export function ReviewCompleteSummary({
  stats,
  severityCounts,
  categoryStats,
  topIssues,
  onEnterReview,
  onBack,
  className,
}: ReviewCompleteSummaryProps) {
  const runLabel = stats.runId ? formatRunId(stats.runId) : "#unknown";

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="border-l-4 border-success pl-6 py-2 bg-secondary/20">
        <Typography as="h1" size="2xl" className="text-success-text mb-2">
          Review Complete {runLabel}
        </Typography>
        <p className="text-sm text-muted-foreground">
          Found <span className="text-foreground font-bold">{stats.totalIssues} issues</span> across{" "}
          <span className="text-foreground font-bold">{stats.filesAnalyzed} files</span>.
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel className="bg-secondary/10">
          <SectionHeader variant="muted" className="mb-4">
            Severity Breakdown
          </SectionHeader>
          <PanelContent spacing="sm" className="pt-0">
            <SeverityBreakdown counts={severityCounts} />
          </PanelContent>
        </Panel>

        <Panel className="bg-secondary/10">
          <SectionHeader variant="muted" className="mb-4">
            Issues by Category
          </SectionHeader>
          <PanelContent spacing="none" className="pt-0">
            <CategoryStatsTable categories={categoryStats} />
          </PanelContent>
        </Panel>
      </div>

      {topIssues.length > 0 && (
        <div>
          <Typography
            as="h3"
            size="sm"
            className="text-accent mb-3 flex items-center gap-2 uppercase tracking-wider"
          >
            <span aria-hidden="true">!</span> Top Issues Preview
          </Typography>
          <div className="border border-border rounded-sm overflow-hidden">
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
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4 mb-4">
        <Button variant="success" size="lg" onClick={onEnterReview} className="w-full sm:w-auto">
          View Results
        </Button>
        <Button variant="ghost" size="md" onClick={onBack} className="text-muted-foreground">
          [ Back ]
        </Button>
      </div>
    </div>
  );
}
