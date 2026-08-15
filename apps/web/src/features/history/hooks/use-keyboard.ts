import { usePageFooter } from "@diffgazer/core/footer";
import { useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { getHistoryFooter } from "@/features/history/lib/footer";
import type { HistoryFocusZone } from "@/features/history/types";
import { getMainContent } from "@/lib/main-content";

const ZONES = ["warnings", "timeline", "runs", "load-more", "insights", "retry", "search"] as const;
const HISTORY_SCOPE = "history";
type KeyboardHistoryFocusZone = (typeof ZONES)[number];

interface UseHistoryKeyboardOptions {
  enabled: boolean;
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  activeRunId: string | null;
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasWarnings: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  warningsRef: RefObject<HTMLDivElement | null>;
  timelineRef: RefObject<HTMLElement | null>;
  runsListRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: RefObject<HTMLButtonElement | null>;
  insightsListRef: RefObject<HTMLDivElement | null>;
  retryRef: RefObject<HTMLButtonElement | null>;
  highlightedIssueId: string | null;
  onHighlightIssue: (id: string | null) => void;
}

function buildTabCycle({
  hasRuns,
  hasMore,
  hasInsights,
  hasRetry,
  hasWarnings,
}: {
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasWarnings: boolean;
}): KeyboardHistoryFocusZone[] {
  const cycle: KeyboardHistoryFocusZone[] = [];
  if (hasWarnings) cycle.push("warnings");
  cycle.push("search", "timeline");
  if (hasRuns) cycle.push("runs");
  if (hasMore) cycle.push("load-more");
  if (hasInsights) cycle.push("insights");
  if (hasRetry) cycle.push("retry");
  return cycle;
}

// A zone's target can unmount while that zone is still selected: the last page
// loads away the load-more button, activating retry swaps the error alert for
// the loading note, and an empty history renders no runs list. Resolving the
// zone during render keeps the footer, the key guards, and the focus target on
// a control that still exists; useFocusZone sees the resolved zone change and
// moves focus there, and that pane's own onFocus writes the page's zone state
// back in sync.
function resolveFocusZone({
  zone,
  hasRuns,
  hasMore,
  hasInsights,
  hasRetry,
  hasWarnings,
}: {
  zone: HistoryFocusZone;
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasWarnings: boolean;
}): HistoryFocusZone {
  const targetGone =
    (zone === "load-more" && !hasMore) ||
    (zone === "retry" && !hasRetry) ||
    (zone === "runs" && !hasRuns) ||
    (zone === "insights" && !hasInsights) ||
    (zone === "warnings" && !hasWarnings);
  if (!targetGone) return zone;
  if (hasRetry) return "retry";
  return hasRuns ? "runs" : "search";
}

export function useHistoryKeyboard({
  enabled,
  focusZone,
  setFocusZone,
  activeRunId,
  hasRuns,
  hasMore,
  hasInsights,
  hasRetry,
  hasWarnings,
  searchInputRef,
  warningsRef,
  timelineRef,
  runsListRef,
  loadMoreRef,
  insightsListRef,
  retryRef,
  highlightedIssueId,
  onHighlightIssue,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();

  const tabCycle = buildTabCycle({ hasRuns, hasMore, hasInsights, hasRetry, hasWarnings });
  const effectiveFocusZone = resolveFocusZone({
    zone: focusZone,
    hasRuns,
    hasMore,
    hasInsights,
    hasRetry,
    hasWarnings,
  });

  const zoneTargets: Record<KeyboardHistoryFocusZone, RefObject<HTMLElement | null>> = {
    warnings: warningsRef,
    search: searchInputRef,
    timeline: timelineRef,
    runs: runsListRef,
    "load-more": loadMoreRef,
    insights: insightsListRef,
    retry: retryRef,
  };

  useFocusZone({
    initial: "runs",
    zones: ZONES,
    zone: effectiveFocusZone,
    onZoneChange: (zone) => setFocusZone(zone),
    scope: HISTORY_SCOPE,
    tabCycle,
    tabCycleScope: "document",
    tabCycleBoundary: getMainContent,
    focus: {
      autoFocus: true,
      targets: zoneTargets,
    },
    enabled,
    transitions: ({ zone, key }) => {
      let insightsZone: KeyboardHistoryFocusZone | null = null;
      if (hasInsights) insightsZone = "insights";
      else if (hasRetry) insightsZone = "retry";

      const left: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        warnings: null,
        timeline: null,
        runs: "timeline",
        "load-more": "runs",
        insights: "runs",
        retry: "runs",
        search: hasWarnings ? "warnings" : "runs",
      };
      const right: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        warnings: "search",
        timeline: "runs",
        runs: hasMore ? "load-more" : insightsZone,
        "load-more": insightsZone,
        insights: null,
        retry: null,
        search: null,
      };
      if (key === "ArrowLeft") return left[zone] ?? null;
      if (key === "ArrowRight") return right[zone] ?? null;
      return null;
    },
  });

  useScopedNavigation({
    containerRef: insightsListRef,
    role: "option",
    highlighted: highlightedIssueId,
    onHighlightChange: onHighlightIssue,
    wrap: false,
    scope: HISTORY_SCOPE,
    enabled: enabled && effectiveFocusZone === "insights",
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
  });

  useKey(
    "/",
    () => {
      setFocusZone("search");
    },
    {
      scope: HISTORY_SCOPE,
      enabled: enabled && effectiveFocusZone !== "search",
      preventDefault: true,
    },
  );

  const navigateToSelectedRun = () => {
    if (activeRunId) {
      navigate({ to: "/review/{-$reviewId}", params: { reviewId: activeRunId } });
    }
  };

  // Space belongs to the runs listbox, which routes it to onSelect and gives an
  // in-progress typeahead query precedence; a window-level duplicate would fire
  // on the same keystroke and navigate mid-query.
  useKey("o", navigateToSelectedRun, {
    scope: HISTORY_SCOPE,
    enabled: enabled && effectiveFocusZone === "runs",
  });

  useKey(
    "Escape",
    () => {
      navigate({ to: "/" });
    },
    { scope: HISTORY_SCOPE, enabled },
  );

  const { shortcuts, rightShortcuts } = getHistoryFooter(effectiveFocusZone);

  // The error branch renders its own FailureView footer; publishing history
  // shortcuts here would overwrite it, since parent effects run last.
  usePageFooter({
    shortcuts,
    rightShortcuts,
    enabled,
  });
}
