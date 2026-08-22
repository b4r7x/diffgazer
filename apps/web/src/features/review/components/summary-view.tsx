import { usePageFooter } from "@diffgazer/core/footer";
import {
  buildCategoryStats,
  buildDroppedFindingsNotice,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
  type FailedTerminalOutcome,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { DECLINE, useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";
import {
  CHROME_ZONE,
  chromeReturnShortcut,
  useChromeBackHandoff,
} from "@/components/layout/header-chrome";
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
  /** Set when the run ended on a failed outcome; the summary then reports the failure. */
  outcome?: FailedTerminalOutcome;
  onEnterReview: () => void;
  onBack: () => void;
}

const SUMMARY_SCOPE = "review-summary";
// The summary hands off from one place - the top edge of its region - so the
// chrome link needs a single page zone; the content/actions split stays inside
// useActionRowNavigation.
const SUMMARY_ZONE = "summary";
type SummaryZone = typeof SUMMARY_ZONE | typeof CHROME_ZONE;

// The action row, the summary region and the header chrome bind different keys,
// so the legend names the zone that holds focus: ←/→ is inert inside the region,
// and the keys that do work there - the scroll keys, and Tab back to the row -
// are named nowhere else.
function getSummaryShortcuts({
  parked,
  returnZone,
  inActions,
  canOpenResults,
}: {
  /** Focus sits outside the page panel, by the ↑ hand-off or by Tab. */
  parked: boolean;
  returnZone: SummaryZone | null;
  inActions: boolean;
  canOpenResults: boolean;
}): Shortcut[] {
  // Focus left the panel, so the row's keys stood down with it: only the arrow
  // back is left, and only while a hand-off left something to go back to.
  if (parked) return chromeReturnShortcut(returnZone, { summary: "Summary" });

  // A run with no findings to open leaves a lone [← Back] with nowhere to move
  // to, so that screen names the one key the row still binds instead: the way
  // back up into the region.
  if (inActions) {
    if (!canOpenResults) return [{ key: "↑", label: "Summary" }];
    return [
      { key: "←/→", label: "Move Action" },
      { key: "Enter", label: "View Results" },
    ];
  }

  const openResults: Shortcut[] = canOpenResults ? [{ key: "Enter", label: "View Results" }] : [];
  return [{ key: "↑/↓", label: "Scroll" }, { key: "Tab", label: "Actions" }, ...openResults];
}

export function ReviewSummaryView({
  issues,
  reviewId,
  durationMs,
  lensStats,
  droppedDuplicates,
  droppedBelowThreshold,
  minSeverity,
  outcome,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps) {
  const summary = buildReviewSummary(issues);
  const notices = [
    buildDuplicateCollapseNotice(droppedDuplicates, summary.total),
    buildHiddenIssuesNotice(droppedBelowThreshold, minSeverity),
    buildDroppedFindingsNotice(outcome),
  ].filter((notice): notice is string => Boolean(notice));
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

  // A failed run has no results screen to open unless findings survived it, so
  // the action and the key that would open one are withheld rather than left to
  // land on an empty list.
  const canOpenResults = outcome === undefined || issues.length > 0;

  useScope(SUMMARY_SCOPE);
  useKey(
    "Enter",
    (event) => {
      if (!isInteractiveTarget(event.target)) {
        onEnterReview();
        return;
      }
      return DECLINE;
    },
    { enabled: canOpenResults },
  );
  useKey("Escape", onBack);

  // The labelled ScrollArea is the content-zone target: ↑ from the action row
  // focuses it so overflowing summary content stays keyboard-scrollable, and ↓
  // scrolls until the bottom, where it hands the action row back.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelFocus = useFocusWithin<HTMLDivElement>();
  const [inChrome, setInChrome] = useState(false);
  const actions = canOpenResults ? [onBack, onEnterReview] : [onBack];
  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    defaultZone: "actions",
    // Mount lands on [View Results]: the primary action is this screen's focus
    // target, not the summary region. With no results to open, the row falls
    // back to its first enabled action, [← Back].
    defaultIndex: 1,
    // Scoped to the panel so the row's keys stand down the moment focus leaves
    // it: parked on the header Back button, ←/→/↑ must not yank focus back into
    // the page, and ↓ belongs to the chrome hand-off below.
    containerRef: panelRef,
    disabledFocusFallbackRef: scrollRef,
    onAction: (index) => actions[index]?.(),
  });
  const chrome = useChromeBackHandoff({
    zone: inChrome ? CHROME_ZONE : SUMMARY_ZONE,
    setZone: (next) => setInChrome(next === CHROME_ZONE),
    scope: SUMMARY_SCOPE,
  });

  usePageFooter({
    shortcuts: getSummaryShortcuts({
      // Focus outside the panel is what disarms the row's keys, whether it left
      // by the ↑ hand-off or by Tab - the legend follows the same fact.
      parked: !panelFocus.focusWithin,
      returnZone: chrome.returnZone,
      inActions: footer.inActions,
      canOpenResults,
    }),
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
  // ↑ mirrors it at the top edge, where the screen ends and the chrome begins.
  const handleRegionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const region = event.currentTarget;
    if (event.key === "ArrowUp") {
      if (region.scrollTop > 0) return;
      event.preventDefault();
      chrome.handOff();
      return;
    }
    if (event.key !== "ArrowDown") return;
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
        ref={panelRef}
        {...panelFocus.props}
        // Leaving the chrome by Tab ends the park: the hand-off hook expects the
        // page to sync its own zone back when focus returns, and nothing else on
        // this screen watches focusin. Without it the footer keeps naming the way
        // down into a summary that already holds focus.
        onFocus={(event) => {
          panelFocus.props.onFocus(event);
          setInChrome(false);
        }}
        focused={panelFocus.focusWithin}
        className="mx-auto flex w-full min-h-0 max-w-4xl flex-col shadow-2xl"
      >
        <Panel.Label variant="border" aria-hidden="true">
          Review Summary
        </Panel.Label>
        {/* ScrollArea rather than a bare overflow-y-auto: the summary was the
            one scroll region left with the unstyled platform scrollbar, which
            read as a stray desktop strip down the right edge at phone widths.
            It is the Panel's direct child and carries the pane padding itself -
            the idiom every other pane uses - so the 6px bar rides the pane's
            inner edge instead of being carved out of the text column by a
            padded wrapper around it; text-sm carries the base that wrapper set
            and the colour comes from --panel-fg. No ring of its own: the Panel
            reticle already names the pane it landed in, and a pane wears one
            mark. */}
        <ScrollArea
          ref={scrollRef}
          aria-label="Review summary"
          className="min-h-0 flex-1 px-5 py-3.5 text-sm focus:outline-none"
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
              outcome={outcome}
              lensStats={lensStats}
            />
            <RunDetailsPanel notices={notices} lensRows={lensRows} />
          </div>
        </ScrollArea>
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
          {canOpenResults && (
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
          )}
        </Panel.Footer>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
