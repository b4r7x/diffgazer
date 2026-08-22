import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  type Shortcut,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import { chromeReturnShortcut } from "@/components/layout/header-chrome";
import type { HistoryFocusZone } from "@/features/history/types";

export interface HistoryFooter {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

export function getHistoryFooter(
  focusZone: HistoryFocusZone,
  {
    hasMore,
    hasListRetry,
    chromeReturnZone,
  }: { hasMore: boolean; hasListRetry: boolean; chromeReturnZone: HistoryFocusZone | null },
): HistoryFooter {
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: [{ key: "Esc", label: "Clear Search" }],
    };
  }

  // l and R are bound for the whole screen, not for one zone, so every zone that
  // is not typing into the search box advertises them while they are live. The
  // zone whose own button already carries the action leaves its key out rather
  // than printing the same label twice.
  const loadMoreKey: Shortcut[] = hasMore ? [{ key: "l", label: "Load Older Runs" }] : [];
  const retryKey: Shortcut[] = hasListRetry ? [{ key: "R", label: "Retry History" }] : [];
  const listKeys = [...loadMoreKey, ...retryKey];

  // Parked on the header Back button: the zone keys are gone with the zone, so
  // only the arrow back to the region that handed off, the screen-wide
  // accelerators, and Escape are still live.
  if (focusZone === "chrome") {
    return {
      shortcuts: [
        ...chromeReturnShortcut(chromeReturnZone, { search: "Search", warnings: "Warnings" }),
        ...listKeys,
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "warnings") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, { key: "↑/↓", label: "Scroll Warnings" }, ...listKeys],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "timeline") {
    return {
      shortcuts: [
        SWITCH_PANE_SHORTCUT,
        NAVIGATE_SHORTCUT,
        { key: "Enter/Space", label: "Select Date" },
        { key: "/", label: "Search" },
        ...listKeys,
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
        ...listKeys,
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "load-more") {
    return {
      shortcuts: [
        SWITCH_PANE_SHORTCUT,
        { key: "Enter/Space", label: "Load Older Runs" },
        ...retryKey,
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "retry") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, { key: "Enter/Space", label: "Retry" }, ...listKeys],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  if (focusZone === "list-retry") {
    return {
      shortcuts: [
        SWITCH_PANE_SHORTCUT,
        { key: "Enter/Space", label: "Retry History" },
        ...loadMoreKey,
      ],
      rightShortcuts: [BACK_SHORTCUT],
    };
  }

  return {
    shortcuts: [
      SWITCH_PANE_SHORTCUT,
      NAVIGATE_SHORTCUT,
      // o opens the highlighted run from the runs list, as it does in the TUI.
      { key: "Enter/Space/o", label: "Open Review" },
      { key: "/", label: "Search" },
      ...listKeys,
    ],
    rightShortcuts: [BACK_SHORTCUT],
  };
}
