import { AnalysisSummary, type IssuePreview } from "@/features/review/components/analysis-summary";
import type { LensStats } from "@/features/review/components/lens-stats-table";
import type { ReviewIssue } from "@stargazer/schemas/review";
import { useScope, useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { calculateSeverityCounts } from "@stargazer/core/severity";

const CATEGORY_META: Record<string, { icon: string; iconColor: string }> = {
  security: { icon: "shield", iconColor: "text-tui-red" },
  performance: { icon: "zap", iconColor: "text-tui-yellow" },
  default: { icon: "code", iconColor: "text-tui-blue" },
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
  const severityCounts = calculateSeverityCounts(issues);

  const categoryCountMap = issues.reduce<Record<string, number>>(
    (acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    },
    {},
  );

  const lensStats: LensStats[] = Object.entries(categoryCountMap).map(
    ([category, count]) => {
      const meta = CATEGORY_META[category] ?? CATEGORY_META.default;
      return {
        id: category,
        name: category.charAt(0).toUpperCase() + category.slice(1),
        icon: meta.icon,
        iconColor: meta.iconColor,
        count,
        change: 0,
      };
    },
  );

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity,
  }));

  const filesAnalyzed = new Set(issues.map((i) => i.file)).size;

  const stats = {
    runId: reviewId ?? "unknown",
    totalIssues: issues.length,
    filesAnalyzed,
    criticalCount: severityCounts.blocker,
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
          severityCounts={severityCounts}
          lensStats={lensStats}
          topIssues={topIssues}
          onEnterReview={onEnterReview}
          onBack={onBack}
        />
      </div>
    </div>
  );
}
