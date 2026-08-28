import {
  buildCompletionHeadline,
  buildMissingLensIssuesNotice,
  buildTerminalCoverageLine,
  describeTerminalOutcome,
  type FailedTerminalOutcome,
  getLensCoverage,
  hasFailedLenses,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { CategoryStats } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, SeverityCounts } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { RunReceipt, type RunReceiptRow } from "@/components/shared/run-receipt";
import { SeverityBreakdown } from "@/components/shared/severity/breakdown";
import { CategoryStatsTable } from "./category-stats-table";
import { IssuePreviewItem } from "./issue-preview-item";

interface AnalysisStats {
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
  /** The run's evidence ledger, rendered under the headline. */
  receiptRows: RunReceiptRow[];
  receiptStub: RunReceiptRow;
  /** Set when the run ended on a failed outcome; the panel then reports the failure. */
  outcome?: FailedTerminalOutcome;
  lensStats?: LensStat[];
  className?: string;
}

type RunStatusTone = "error" | "warning" | "success";

/**
 * The frame's tone follows the headline: a terminal failure is the error frame,
 * a completed run with failed lenses headlines "Partially Complete" and must
 * not wear success-green — it takes the warning frame instead.
 */
function getRunStatusTone(hasFailure: boolean, isPartial: boolean): RunStatusTone {
  if (hasFailure) return "error";
  return isPartial ? "warning" : "success";
}

// tone repaints border-color only, so the corner chip — which tracks the
// enclosure through --panel-border-color — would keep the neutral edge;
// lifting --panel-border puts chip and frame on the same colour.
const RUN_STATUS_STYLES: Record<RunStatusTone, { panel: string; headline: string }> = {
  error: { panel: "[--panel-border:var(--error-border)]", headline: "text-error-text" },
  warning: { panel: "[--panel-border:var(--warning-border)]", headline: "text-warning-text" },
  success: { panel: "[--panel-border:var(--success-border)]", headline: "text-success-text" },
};

/**
 * The one fact line the run earns: what it found, and where. Elapsed time is
 * the receipt's business now, so the line does not say it twice. A run that
 * found nothing here is a partial or failed one, which says so in words rather
 * than filling the template with zeros.
 */
function buildFactLine(stats: AnalysisStats): string {
  if (stats.totalIssues === 0) return "No issues found";
  return `${pluralize(stats.totalIssues, "issue")} in ${pluralize(stats.filesWithIssues, "file")}`;
}

export function ReviewCompleteSummary({
  stats,
  severityCounts,
  categoryStats,
  topIssues,
  receiptRows,
  receiptStub,
  outcome,
  lensStats,
  className,
}: ReviewCompleteSummaryProps) {
  // A failed run names its outcome, how far it got and which lenses produced
  // nothing. Nothing here may read as a pass: no success tone, no "Review
  // Complete", and the zero-issue phrasing that congratulates a clean run.
  // The coverage sentence carries the ratio, so the notice beside it is the
  // names-only half - the same fact twice in opposite polarity reads as padding.
  const failure = outcome ? describeTerminalOutcome(outcome) : null;
  const missingFindings = failure ? buildMissingLensIssuesNotice(lensStats) : "";
  const runTone = getRunStatusTone(failure !== null, hasFailedLenses(lensStats));
  const runStyles = RUN_STATUS_STYLES[runTone];
  const hasBreakdowns = stats.totalIssues > 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* From lg the verdict and its breakdowns sit side by side so the summary
          stops being a column the reader has to scroll through; below that they
          stack in reading order, verdict first. */}
      <div className={cn("grid gap-4", hasBreakdowns && "lg:grid-cols-2 lg:items-start")}>
        <Panel tone={runTone} density="compact" aria-label="Run status" className={runStyles.panel}>
          <Panel.Label variant="border" aria-hidden="true">
            Run Status
          </Panel.Label>
          <Panel.Content spacing="none">
            {/* The alert wrapper, not the heading itself: role="alert" on a heading
                element replaces its heading role, and a failed run wants both the
                announcement and a real heading in the outline. */}
            <div role={failure ? "alert" : undefined}>
              {/* The run headline stays at terminal scale below sm: at display size it
                  wraps to two lines at 375 and dwarfs the panels underneath it. */}
              <Typography as="h1" size="lg" className={cn("mb-2 sm:text-2xl", runStyles.headline)}>
                {failure ? failure.title : buildCompletionHeadline(lensStats)}
              </Typography>
              <p className="text-sm text-muted-foreground">
                {failure
                  ? buildTerminalCoverageLine({
                      coverage: getLensCoverage(lensStats),
                      issueCount: stats.totalIssues,
                    })
                  : buildFactLine(stats)}
              </p>
              {missingFindings ? (
                <p className="mt-1 text-sm text-warning-text">{missingFindings}</p>
              ) : null}
            </div>
            {stats.blockerCount > 0 && (
              <p className="mt-1 text-sm font-bold text-error-text">
                {pluralize(stats.blockerCount, "blocker")} found.
              </p>
            )}
            {/* The same ledger the clean state is made of: scope, lenses, model
                and elapsed, with the run id torn off below the stitch. It is what
                used to be a bare fact line and a loose duration row. */}
            <RunReceipt rows={receiptRows} stub={receiptStub} className="mt-4" />
          </Panel.Content>
        </Panel>

        {hasBreakdowns && (
          // Two across while the verdict is above them, one column once they
          // move into the grid's right half.
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
            {/* Labelled panels, like every other block of information in the app.
                The frames stay at rest: the single reticle belongs to the page
                panel enclosing the summary, claimed while focus sits inside it.
                A run with nothing to break down renders neither: a chart of zeros
                is a shape with no reading. */}
            <Panel density="compact" aria-label="Severity breakdown">
              <Panel.Label variant="border" aria-hidden="true">
                Severity Breakdown
              </Panel.Label>
              <Panel.Content spacing="sm">
                <SeverityBreakdown counts={severityCounts} />
              </Panel.Content>
            </Panel>

            <Panel density="compact" aria-label="Issues by category">
              <Panel.Label variant="border" aria-hidden="true">
                Issues by Category
              </Panel.Label>
              <Panel.Content spacing="sm">
                <CategoryStatsTable categories={categoryStats} />
              </Panel.Content>
            </Panel>
          </div>
        )}
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
