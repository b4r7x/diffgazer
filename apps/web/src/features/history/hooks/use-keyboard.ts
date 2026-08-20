import { usePageFooter } from "@diffgazer/core/footer";
import { useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { CHROME_ZONE } from "@/components/layout/header-chrome";
import { getHistoryFooter } from "@/features/history/lib/footer";
import type { HistoryFocusZone } from "@/features/history/types";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";
import { getMainContent } from "@/lib/main-content";

const ZONES = [
  "warnings",
  "list-retry",
  "timeline",
  "runs",
  "load-more",
  "insights",
  "retry",
  "search",
  // Last: an unknown zone falls back to the first entry, which must be a zone
  // inside the page rather than the parked chrome.
  "chrome",
] as const;
const HISTORY_SCOPE = "history";
type KeyboardHistoryFocusZone = (typeof ZONES)[number];

interface UseHistoryKeyboardOptions {
  enabled: boolean;
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  activeRunId: string | null;
  hasRuns: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasListRetry: boolean;
  hasWarnings: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  warningsRef: RefObject<HTMLDivElement | null>;
  listRetryRef: RefObject<HTMLButtonElement | null>;
  timelineRef: RefObject<HTMLElement | null>;
  runsListRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: RefObject<HTMLButtonElement | null>;
  insightsListRef: RefObject<HTMLDivElement | null>;
  retryRef: RefObject<HTMLButtonElement | null>;
  highlightedIssueId: string | null;
  onHighlightIssue: (id: string | null) => void;
  onLoadMore: () => void;
  onRetryList: () => void;
}

function buildTabCycle({
  hasRuns,
  hasMore,
  hasInsights,
  hasRetry,
  hasListRetry,
  hasWarnings,
}: {
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasListRetry: boolean;
  hasWarnings: boolean;
}): KeyboardHistoryFocusZone[] {
  const cycle: KeyboardHistoryFocusZone[] = [];
  if (hasWarnings) cycle.push("warnings");
  if (hasListRetry) cycle.push("list-retry");
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
  hasListRetry,
  hasWarnings,
}: {
  zone: HistoryFocusZone;
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
  hasListRetry: boolean;
  hasWarnings: boolean;
}): HistoryFocusZone {
  const targetGone =
    (zone === "load-more" && !hasMore) ||
    (zone === "retry" && !hasRetry) ||
    (zone === "list-retry" && !hasListRetry) ||
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
  isLoadingMore,
  hasInsights,
  hasRetry,
  hasListRetry,
  hasWarnings,
  searchInputRef,
  warningsRef,
  listRetryRef,
  timelineRef,
  runsListRef,
  loadMoreRef,
  insightsListRef,
  retryRef,
  highlightedIssueId,
  onHighlightIssue,
  onLoadMore,
  onRetryList,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();

  const tabCycle = buildTabCycle({
    hasRuns,
    hasMore,
    hasInsights,
    hasRetry,
    hasListRetry,
    hasWarnings,
  });
  const effectiveFocusZone = resolveFocusZone({
    zone: focusZone,
    hasRuns,
    hasMore,
    hasInsights,
    hasRetry,
    hasListRetry,
    hasWarnings,
  });

  // The chrome is deliberately absent: it owns no target the page repairs focus
  // to, and a registered container there would let the pane Tab cycle claim Tab
  // from the Back button instead of letting native Tab re-enter the page.
  const zoneTargets: Record<
    Exclude<KeyboardHistoryFocusZone, typeof CHROME_ZONE>,
    RefObject<HTMLElement | null>
  > = {
    warnings: warningsRef,
    "list-retry": listRetryRef,
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
        // The chrome is left by Tab or by activating Back, never by an arrow.
        chrome: null,
        warnings: null,
        "list-retry": null,
        timeline: null,
        runs: "timeline",
        "load-more": "runs",
        insights: "runs",
        retry: "runs",
        search: hasWarnings ? "warnings" : "runs",
      };
      const right: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        chrome: null,
        warnings: "search",
        "list-retry": null,
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

  // Space belongs to the runs listbox, which routes it to onSelect; a
  // window-level duplicate would fire on the same keystroke. o stays free for
  // this binding because the runs list opts out of typeahead.
  useKey("o", navigateToSelectedRun, {
    scope: HISTORY_SCOPE,
    enabled: enabled && effectiveFocusZone === "runs",
  });

  // The TUI's list accelerators: R retries a failed list refresh, l loads the
  // next page. The TUI's w (toggle warning IDs) has no web binding on purpose —
  // the web warnings region is always visible.
  useKey("R", onRetryList, { scope: HISTORY_SCOPE, enabled: enabled && hasListRetry });
  useKey("l", onLoadMore, { scope: HISTORY_SCOPE, enabled: enabled && hasMore && !isLoadingMore });

  useKey(
    "Escape",
    () => {
      performBackAction(router, resolveBackAction(pathname, canGoBack));
    },
    { scope: HISTORY_SCOPE, enabled },
  );

  const { shortcuts, rightShortcuts } = getHistoryFooter(effectiveFocusZone, {
    hasMore,
    hasListRetry,
  });

  // The error branch renders its own FailureView footer; publishing history
  // shortcuts here would overwrite it, since parent effects run last.
  usePageFooter({
    shortcuts,
    rightShortcuts,
    enabled,
  });
}
