import { usePageFooter } from "@diffgazer/core/footer";
import { useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { HistoryFocusZone } from "@/features/history/types";

const ZONES = ["timeline", "runs", "insights", "search"] as const;
const HISTORY_SCOPE = "history";
type KeyboardHistoryFocusZone = (typeof ZONES)[number];

interface UseHistoryKeyboardOptions {
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  activeRunId: string | null;
  hasRuns: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  runsListRef: RefObject<HTMLDivElement | null>;
  insightsListRef: RefObject<HTMLDivElement | null>;
  highlightedIssueId: string | null;
  onHighlightIssue: (id: string | null) => void;
}

function buildTabCycle(hasRuns: boolean, hasActiveRun: boolean): KeyboardHistoryFocusZone[] {
  const cycle: KeyboardHistoryFocusZone[] = ["search", "timeline"];
  if (hasRuns) cycle.push("runs");
  if (hasActiveRun) cycle.push("insights");
  return cycle;
}

export function getHistoryFooter(focusZone: HistoryFocusZone) {
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: [{ key: "Esc", label: "Clear Search" }],
    };
  }

  if (focusZone === "timeline") {
    return {
      shortcuts: [
        { key: "Tab", label: "Switch Focus" },
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Select Date" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  if (focusZone === "insights") {
    return {
      shortcuts: [
        { key: "Tab", label: "Switch Focus" },
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Open Issue" },
        { key: "←", label: "Review Runs" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  return {
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter/Space", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  };
}

export function useHistoryKeyboard({
  focusZone,
  setFocusZone,
  activeRunId,
  hasRuns,
  searchInputRef,
  runsListRef,
  insightsListRef,
  highlightedIssueId,
  onHighlightIssue,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();

  const tabCycle = buildTabCycle(hasRuns, activeRunId !== null);

  useFocusZone({
    initial: "runs",
    zones: ZONES,
    zone: focusZone,
    onZoneChange: (zone) => setFocusZone(zone),
    scope: HISTORY_SCOPE,
    tabCycle,
    focus: {
      autoFocus: true,
      targets: {
        search: searchInputRef,
        runs: runsListRef,
        insights: insightsListRef,
      },
    },
    transitions: ({ zone, key }) => {
      const left: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        timeline: null,
        runs: "timeline",
        insights: "runs",
        search: "runs",
      };
      const right: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        timeline: "runs",
        runs: "insights",
        insights: null,
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
    enabled: focusZone === "insights",
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
  });

  useKey(
    "/",
    () => {
      setFocusZone("search");
    },
    { scope: HISTORY_SCOPE, enabled: focusZone !== "search", preventDefault: true },
  );

  const navigateToSelectedRun = () => {
    if (activeRunId) {
      navigate({ to: "/review/{-$reviewId}", params: { reviewId: activeRunId } });
    }
  };

  useKey("o", navigateToSelectedRun, { scope: HISTORY_SCOPE, enabled: focusZone === "runs" });
  useKey(" ", navigateToSelectedRun, { scope: HISTORY_SCOPE, enabled: focusZone === "runs" });

  useKey(
    "Escape",
    () => {
      navigate({ to: "/" });
    },
    { scope: HISTORY_SCOPE },
  );

  const { shortcuts, rightShortcuts } = getHistoryFooter(focusZone);

  usePageFooter({
    shortcuts,
    rightShortcuts,
  });
}
