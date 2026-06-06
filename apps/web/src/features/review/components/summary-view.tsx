import { usePageFooter } from "@diffgazer/core/footer";
import { buildLensStats, buildReviewSummary } from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useKey, useScope } from "@diffgazer/keys";
import { AnalysisSummary, type IssuePreview } from "@/features/review/components/analysis-summary";
import type { LensStats } from "@/features/review/components/lens-stats-table";

interface CategoryMeta {
  icon: string;
  iconColor: string;
}

const DEFAULT_CATEGORY_META: CategoryMeta = { icon: "code", iconColor: "text-tui-blue" };

const CATEGORY_META: Record<string, CategoryMeta> = {
  security: { icon: "shield", iconColor: "text-tui-red" },
  performance: { icon: "zap", iconColor: "text-tui-yellow" },
};

interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  onEnterReview: () => void;
  onBack: () => void;
}

export function ReviewSummaryView({
  issues,
  reviewId,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps) {
  const summary = buildReviewSummary(issues);

  const lensStats: LensStats[] = buildLensStats(issues).map((stat) => {
    const meta = CATEGORY_META[stat.id] ?? DEFAULT_CATEGORY_META;
    return { ...stat, icon: meta.icon, iconColor: meta.iconColor };
  });

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity,
  }));

  const stats = {
    runId: reviewId ?? "unknown",
    totalIssues: summary.total,
    filesAnalyzed: summary.filesAnalyzed,
    criticalCount: summary.criticalCount,
  };

  useScope("review-summary");
  useKey("Enter", onEnterReview);
  useKey("Escape", onBack);

  usePageFooter({
    shortcuts: [{ key: "Enter", label: "Start Review" }],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="w-full max-w-4xl mx-auto">
        <AnalysisSummary
          stats={stats}
          severityCounts={summary.severityCounts}
          lensStats={lensStats}
          topIssues={topIssues}
          onEnterReview={onEnterReview}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
