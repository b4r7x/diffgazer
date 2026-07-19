import { usePageFooter } from "@diffgazer/core/footer";
import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import { useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { HistoryFocusZone } from "@/features/history/types";
import { getMainContent } from "@/lib/main-content";

const ZONES = ["timeline", "runs", "load-more", "insights", "retry", "search"] as const;
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
  searchInputRef: RefObject<HTMLInputElement | null>;
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
}: {
  hasRuns: boolean;
  hasMore: boolean;
  hasInsights: boolean;
  hasRetry: boolean;
}): KeyboardHistoryFocusZone[] {
  const cycle: KeyboardHistoryFocusZone[] = ["search", "timeline"];
  if (hasRuns) cycle.push("runs");
  if (hasMore) cycle.push("load-more");
  if (hasInsights) cycle.push("insights");
  if (hasRetry) cycle.push("retry");
  return cycle;
}

function getHistoryFooter(focusZone: HistoryFocusZone) {
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: [{ key: "Esc", label: "Clear Search" }],
    };
  }

  if (focusZone === "timeline") {
    return {
      shortcuts: [
        SWITCH_PANE_SHORTCUT,
        NAVIGATE_SHORTCUT,
        { key: "Enter/Space", label: "Select Date" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "insights") {
    return {
      shortcuts: [
        SWITCH_PANE_SHORTCUT,
        NAVIGATE_SHORTCUT,
        { key: "Enter/Space", label: "Open Issue" },
        { key: "←", label: "Runs" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "load-more") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, { key: "Enter/Space", label: "Load Older Runs" }],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "retry") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, { key: "Enter/Space", label: "Retry" }],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  return {
    shortcuts: [
      SWITCH_PANE_SHORTCUT,
      NAVIGATE_SHORTCUT,
      { key: "Enter/Space", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: [BACK_SHORTCUT],
  };
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
  searchInputRef,
  timelineRef,
  runsListRef,
  loadMoreRef,
  insightsListRef,
  retryRef,
  highlightedIssueId,
  onHighlightIssue,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();

  const tabCycle = buildTabCycle({ hasRuns, hasMore, hasInsights, hasRetry });

  useFocusZone({
    initial: "runs",
    zones: ZONES,
    zone: focusZone,
    onZoneChange: (zone) => setFocusZone(zone),
    scope: HISTORY_SCOPE,
    tabCycle,
    tabCycleScope: "document",
    tabCycleBoundary: getMainContent,
    focus: {
      autoFocus: true,
      targets: {
        search: searchInputRef,
        timeline: timelineRef,
        runs: runsListRef,
        "load-more": loadMoreRef,
        insights: insightsListRef,
        retry: retryRef,
      },
    },
    enabled,
    transitions: ({ zone, key }) => {
      let insightsZone: KeyboardHistoryFocusZone | null = null;
      if (hasInsights) insightsZone = "insights";
      else if (hasRetry) insightsZone = "retry";

      const left: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        timeline: null,
        runs: "timeline",
        "load-more": "runs",
        insights: "runs",
        retry: "runs",
        search: "runs",
      };
      const right: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
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
    enabled: enabled && focusZone === "insights",
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
      enabled: enabled && focusZone !== "search",
      preventDefault: true,
    },
  );

  const navigateToSelectedRun = () => {
    if (activeRunId) {
      navigate({ to: "/review/{-$reviewId}", params: { reviewId: activeRunId } });
    }
  };

  useKey("o", navigateToSelectedRun, {
    scope: HISTORY_SCOPE,
    enabled: enabled && focusZone === "runs",
  });
  useKey(" ", navigateToSelectedRun, {
    scope: HISTORY_SCOPE,
    enabled: enabled && focusZone === "runs",
  });

  useKey(
    "Escape",
    () => {
      navigate({ to: "/" });
    },
    { scope: HISTORY_SCOPE, enabled },
  );

  const { shortcuts, rightShortcuts } = getHistoryFooter(focusZone);

  usePageFooter({
    shortcuts,
    rightShortcuts,
  });
}
