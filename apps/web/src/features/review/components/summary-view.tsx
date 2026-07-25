import { usePageFooter } from "@diffgazer/core/footer";
import {
  buildCategoryStats,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, type IssuePreview } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { ReviewCompleteSummary } from "@/features/review/components/review-complete-summary";
import { RunDetailsPanel } from "@/features/review/components/run-details-panel";
import { isInteractiveTarget } from "@/features/review/lib/interactive-target";

interface ReviewSummaryViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  durationMs?: number;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
  onEnterReview: () => void;
  onBack: () => void;
}

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  lensStats,
  droppedDuplicates,
  droppedBelowThreshold,
  minSeverity,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps) {
  const summary = buildReviewSummary(issues);
  const notices = [
    buildDuplicateCollapseNotice(droppedDuplicates, summary.total),
    buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity),
  ].filter((notice): notice is string => notice !== null);
  const lensRows = buildLensSummaryRows(lensStats);

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start,
    category: issue.category,
    severity: issue.severity,
  }));

  const stats = {
    runId: reviewId,
    totalIssues: summary.total,
    filesWithIssues: summary.filesWithIssues,
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
    // ScrollArea rather than a bare overflow-y-auto: the summary was the one
    // scroll region left with the unstyled platform scrollbar, which read as a
    // stray desktop strip down the right edge at phone widths. Bottom padding
    // waits for md: a sticky bottom-0 child docks to the scrollport inset by
    // that padding, which left a band under the phone action row for half-rows
    // to render in.
    <ScrollArea className="flex-1 px-4 pt-4 scroll-pb-16 md:scroll-pb-0 md:pb-4">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
        <ReviewCompleteSummary
          stats={stats}
          severityCounts={summary.severityCounts}
          categoryStats={buildCategoryStats(issues)}
          topIssues={topIssues}
          durationMs={durationMs}
        />
        <RunDetailsPanel notices={notices} lensRows={lensRows} />
        {/* The action row is the last element and stays reachable while the
            summary scrolls under it on phones, mirroring the pinned TUI CTA.
            The hairline is what makes a row disappearing under it read as a
            docked bar rather than a clipped render. */}
        <div className="sticky bottom-0 flex justify-center border-t border-border bg-background pb-2 pt-3 md:static md:border-t-0 md:pb-4">
          <Button variant="primary" size="lg" bracket onClick={onEnterReview}>
            View Results
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
