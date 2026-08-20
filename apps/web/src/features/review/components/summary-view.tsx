import { usePageFooter } from "@diffgazer/core/footer";
import {
  buildCategoryStats,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { DECLINE, useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { type FocusEvent, type KeyboardEvent, useRef } from "react";
import { ReviewCompleteSummary } from "@/features/review/components/complete-summary";
import { RunDetailsPanel } from "@/features/review/components/run-details-panel";
import { isInteractiveTarget } from "@/features/review/lib/interactive-target";
import { useFocusWithin } from "@/hooks/use-focus-within";

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

// The action row and the summary region bind different keys, so the legend names
// the zone that holds focus: ←/→ is inert inside the region, and the keys that do
// work there - the scroll keys, and Tab back to the row - are named nowhere else.
function getSummaryShortcuts(inActions: boolean): Shortcut[] {
  if (inActions) {
    return [
      { key: "←/→", label: "Move Action" },
      { key: "Enter", label: "View Results" },
    ];
  }
  return [
    { key: "↑/↓", label: "Scroll" },
    { key: "Tab", label: "Actions" },
    { key: "Enter", label: "View Results" },
  ];
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

  const topIssues = issues.slice(0, 3).map((issue) => ({
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
    if (!isInteractiveTarget(event.target)) {
      onEnterReview();
      return;
    }
    return DECLINE;
  });
  useKey("Escape", onBack);

  // The labelled ScrollArea is the content-zone target: ↑ from the action row
  // focuses it so overflowing summary content stays keyboard-scrollable, and ↓
  // scrolls until the bottom, where it hands the action row back.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelFocus = useFocusWithin<HTMLDivElement>();
  const actions = [onBack, onEnterReview];
  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    defaultZone: "actions",
    // Mount lands on [View Results]: the primary action is this screen's focus
    // target, not the summary region.
    defaultIndex: 1,
    disabledFocusFallbackRef: scrollRef,
    onAction: (index) => actions[index]?.(),
  });

  usePageFooter({
    shortcuts: getSummaryShortcuts(footer.inActions),
    rightShortcuts: [BACK_SHORTCUT],
  });

  // Focus reaches the region without the ↑ path too - Shift+Tab from [← Back], or
  // a click - and the row holds its zone until something releases it, which would
  // leave the only control mark on screen on a button that does not have focus.
  const handleRegionFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) footer.reset();
  };

  // ScrollArea runs this before its own scrolling and honours preventDefault, so ↓
  // scrolls while content remains below and hands the action row back at the end
  // of the range - the same ↓-enters-actions move the row runs when nothing
  // overflows, which is otherwise unreachable once the scroller consumes the key.
  const handleRegionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" || event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const region = event.currentTarget;
    // Fractional layout leaves sub-pixel slack at the end of the scroll range.
    if (region.scrollHeight - region.clientHeight - region.scrollTop > 1) return;
    event.preventDefault();
    footer.enterActions(0);
  };

  return (
    // Page-card shell shared with hub/help/diagnostics: spare height splits 1:2
    // around the panel and the spacers collapse once the summary outgrows the
    // viewport, at which point the ScrollArea inside the panel absorbs the
    // overflow instead of the page.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:p-6 lg:p-8">
      <div aria-hidden className="grow" />
      <Panel
        {...panelFocus.props}
        focused={panelFocus.focusWithin}
        className="mx-auto flex w-full min-h-0 max-w-4xl flex-col shadow-2xl"
      >
        <Panel.Label variant="border" aria-hidden="true">
          Review Summary
        </Panel.Label>
        <Panel.Content spacing="none" className="flex min-h-0 flex-1 flex-col">
          {/* ScrollArea rather than a bare overflow-y-auto: the summary was the
              one scroll region left with the unstyled platform scrollbar, which
              read as a stray desktop strip down the right edge at phone widths.
              No ring of its own: the Panel reticle already names the pane it
              landed in, and a pane wears one mark. */}
          <ScrollArea
            ref={scrollRef}
            aria-label="Review summary"
            className="min-h-0 focus:outline-none"
            onFocus={handleRegionFocus}
            onKeyDown={handleRegionKeyDown}
          >
            {/* pt-4 keeps the corner labels the inner panels hang above their
                top border clear of the scrollport's clipped edge. */}
            <div className="flex flex-col gap-6 pt-4">
              <ReviewCompleteSummary
                stats={stats}
                severityCounts={summary.severityCounts}
                categoryStats={buildCategoryStats(issues)}
                topIssues={topIssues}
                durationMs={durationMs}
              />
              <RunDetailsPanel notices={notices} lensRows={lensRows} />
            </div>
          </ScrollArea>
        </Panel.Content>
        {/* Back is rendered, not just bound to Escape, so leaving the summary
            is discoverable by pointer. */}
        <Panel.Footer className="flex-wrap justify-center gap-3">
          <Button
            {...footer.getActionProps(0)}
            variant="outline"
            size="lg"
            bracket
            highlighted={footer.inActions && footer.focusedIndex === 0}
            onClick={onBack}
          >
            <span aria-hidden="true">←</span> Back
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="primary"
            size="lg"
            bracket
            highlighted={footer.inActions && footer.focusedIndex === 1}
            onClick={onEnterReview}
          >
            View Results
          </Button>
        </Panel.Footer>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
