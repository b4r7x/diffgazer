import { cn } from '@/utils/cn';
import { Panel, PanelHeader, PanelContent } from '@/components/ui/containers';
import { Button } from '@/components/ui/button';
import { SeverityBreakdown } from '@/components/ui/severity';
import { IssuePreviewItem } from './issue-preview-item';
import { LensStatsTable, type LensStats } from './lens-stats-table';
import type { AnalysisStats, SeverityCounts, IssuePreview } from '@stargazer/schemas/ui';

export type { AnalysisStats, SeverityCounts, IssuePreview };

export interface AnalysisSummaryProps {
  stats: AnalysisStats;
  severityCounts: SeverityCounts;
  lensStats: LensStats[];
  topIssues: IssuePreview[];
  onEnterReview?: () => void;
  onExport?: () => void;
  onBack?: () => void;
  onIssueClick?: (id: string) => void;
  className?: string;
}

export function AnalysisSummary({
  stats,
  severityCounts,
  lensStats,
  topIssues,
  onEnterReview,
  onExport,
  onBack,
  onIssueClick,
  className,
}: AnalysisSummaryProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="border-l-4 border-tui-green pl-6 py-2 bg-tui-selection/20">
        <h1 className="text-2xl font-bold text-tui-green mb-2">
          Analysis Complete #{stats.runId}
        </h1>
        <p className="text-sm text-gray-400">
          Found <span className="text-tui-fg font-bold">{stats.totalIssues} issues</span> across{' '}
          <span className="text-tui-fg font-bold">{stats.filesAnalyzed} files</span>.
          {stats.criticalCount > 0 && (
            <>
              {' '}Security lens flagged{' '}
              <span className="text-tui-red font-bold">{stats.criticalCount} critical blockers</span>.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel className="bg-tui-selection/10">
          <PanelHeader variant="section" className="mb-4">
            Severity Breakdown
          </PanelHeader>
          <PanelContent spacing="sm" className="pt-0">
            <SeverityBreakdown counts={severityCounts} />
          </PanelContent>
        </Panel>

        <Panel className="bg-tui-selection/10">
          <PanelHeader variant="section" className="mb-4">
            Issues by Lens
          </PanelHeader>
          <PanelContent spacing="none" className="pt-0">
            <LensStatsTable lenses={lensStats} />
          </PanelContent>
        </Panel>
      </div>

      {topIssues.length > 0 && (
        <div>
          <h3 className="text-tui-violet font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span aria-hidden="true">!</span> Top Issues Preview
          </h3>
          <div className="border border-tui-border rounded-sm overflow-hidden">
            {topIssues.map((issue) => (
              <IssuePreviewItem
                key={issue.id}
                title={issue.title}
                file={issue.file}
                line={issue.line}
                category={issue.category}
                severity={issue.severity}
                onClick={() => onIssueClick?.(issue.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4 mb-4">
        <Button variant="success" size="lg" onClick={onEnterReview} className="w-full sm:w-auto">
          [ Enter Review Queue ]
        </Button>
        <Button variant="outline" size="lg" onClick={onExport} className="w-full sm:w-auto">
          [ Export Summary ]
        </Button>
        <Button variant="ghost" size="md" onClick={onBack} className="text-gray-500">
          [ Back ]
        </Button>
      </div>
    </div>
  );
}
