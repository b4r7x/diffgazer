import { usePageFooter } from "@diffgazer/core/footer";
import {
  buildCategoryStats,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { useKey, useScope } from "@diffgazer/keys";
import type { CategoryStats } from "@/features/review/components/category-stats-table";
import {
  type IssuePreview,
  ReviewCompleteSummary,
} from "@/features/review/components/review-complete-summary";

interface CategoryMeta {
  icon: string;
  iconColor: string;
}

const DEFAULT_CATEGORY_META: CategoryMeta = { icon: "code", iconColor: "text-info-text" };

const CATEGORY_META: Record<string, CategoryMeta> = {
  security: { icon: "shield", iconColor: "text-error-text" },
  performance: { icon: "zap", iconColor: "text-warning-text" },
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, [role="button"], [role="checkbox"], [role="radio"], [role="tab"], [contenteditable="true"]',
    ),
  );
}

interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  lensStats?: LensStat[];
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  onEnterReview: () => void;
  onBack: () => void;
}

export function ReviewSummaryView({
  issues,
  reviewId,
  lensStats,
  droppedBelowThreshold,
  minSeverity,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps) {
  const summary = buildReviewSummary(issues);
  const hiddenNotice = buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity);
  const lensRows = buildLensSummaryRows(lensStats);

  const categoryStats: CategoryStats[] = buildCategoryStats(issues).map((stat) => {
    const meta = CATEGORY_META[stat.id] ?? DEFAULT_CATEGORY_META;
    return { ...stat, icon: meta.icon, iconColor: meta.iconColor };
  });

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start,
    category: issue.category,
    severity: issue.severity,
  }));

  const stats = {
    runId: reviewId ?? "unknown",
    totalIssues: summary.total,
    filesAnalyzed: summary.filesAnalyzed,
    blockerCount: summary.blockerCount,
  };

  useScope("review-summary");
  useKey("Enter", (event) => {
    if (isInteractiveTarget(event.target)) return false;
    onEnterReview();
    return true;
  });
  useKey("Escape", onBack);

  usePageFooter({
    shortcuts: [{ key: "Enter", label: "View Results" }],
    rightShortcuts: [BACK_SHORTCUT],
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="w-full max-w-4xl mx-auto">
        <ReviewCompleteSummary
          stats={stats}
          severityCounts={summary.severityCounts}
          categoryStats={categoryStats}
          topIssues={topIssues}
          onEnterReview={onEnterReview}
          onBack={onBack}
        />
        {hiddenNotice ? (
          <p className="text-muted-foreground font-mono text-xs mt-4" role="note">
            {hiddenNotice}
          </p>
        ) : null}
        {lensRows.length > 0 ? (
          <table className="font-mono text-xs mt-4 w-full">
            <caption className="text-left text-muted-foreground mb-1">Issues by lens</caption>
            <tbody>
              {lensRows.map((row) => (
                <tr key={row.lensId}>
                  <td className="pr-4">{row.label}</td>
                  <td className="pr-4 text-right">
                    {row.status === "failed"
                      ? `failed${row.errorCode ? ` (${row.errorCode})` : ""}`
                      : row.issueCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
