import type {
  AnalysisStats,
  IssuePreview,
  SeverityCounts,
} from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { Panel, PanelContent } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBreakdown } from "@/components/ui/severity/breakdown";
import { IssuePreviewItem } from "./issue-preview-item";
import { type LensStats, LensStatsTable } from "./lens-stats-table";

export type { IssuePreview };

export interface AnalysisSummaryProps {
  stats: AnalysisStats;
  severityCounts: SeverityCounts;
  lensStats: LensStats[];
  topIssues: IssuePreview[];
  onEnterReview?: () => void;
  onBack?: () => void;
  className?: string;
}

export function AnalysisSummary({
  stats,
  severityCounts,
  lensStats,
  topIssues,
  onEnterReview,
  onBack,
  className,
}: AnalysisSummaryProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="border-l-4 border-tui-green pl-6 py-2 bg-tui-selection/20">
        <Typography as="h1" size="2xl" className="text-tui-green mb-2">
          Analysis Complete #{stats.runId}
        </Typography>
        <p className="text-sm text-tui-muted">
          Found <span className="text-tui-fg font-bold">{stats.totalIssues} issues</span> across{" "}
          <span className="text-tui-fg font-bold">{stats.filesAnalyzed} files</span>.
          {stats.criticalCount > 0 && (
            <>
              {" "}
              Security lens flagged{" "}
              <span className="text-tui-red font-bold">
                {stats.criticalCount} critical blockers
              </span>
              .
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel className="bg-tui-selection/10">
          <SectionHeader variant="muted" className="mb-4">
            Severity Breakdown
          </SectionHeader>
          <PanelContent spacing="sm" className="pt-0">
            <SeverityBreakdown counts={severityCounts} />
          </PanelContent>
        </Panel>

        <Panel className="bg-tui-selection/10">
          <SectionHeader variant="muted" className="mb-4">
            Issues by Lens
          </SectionHeader>
          <PanelContent spacing="none" className="pt-0">
            <LensStatsTable lenses={lensStats} />
          </PanelContent>
        </Panel>
      </div>

      {topIssues.length > 0 && (
        <div>
          <Typography
            as="h3"
            size="sm"
            className="text-tui-violet mb-3 flex items-center gap-2 uppercase tracking-wider"
          >
            <span aria-hidden="true">!</span> Top Issues Preview
          </Typography>
          <div className="border border-tui-border rounded-sm overflow-hidden">
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
          [ Enter Review Queue ]
        </Button>
        <Button variant="ghost" size="md" onClick={onBack} className="text-tui-muted">
          [ Back ]
        </Button>
      </div>
    </div>
  );
}
