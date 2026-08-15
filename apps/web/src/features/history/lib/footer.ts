import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  type Shortcut,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import type { HistoryFocusZone } from "@/features/history/types";

export interface HistoryFooter {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

export function getHistoryFooter(focusZone: HistoryFocusZone): HistoryFooter {
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: [{ key: "Esc", label: "Clear Search" }],
    };
  }

  if (focusZone === "warnings") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, { key: "↑/↓", label: "Scroll Warnings" }],
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
