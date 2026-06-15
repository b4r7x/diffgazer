import {
  BACK_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import type { HistoryFocusZone } from "../types";

export interface HistoryFooter {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

const CLEAR: Shortcut[] = [{ key: "Esc", label: "Clear Search" }];

export function getHistoryFooter(focusZone: HistoryFocusZone): HistoryFooter {
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: CLEAR,
    };
  }

  if (focusZone === "timeline") {
    return {
      shortcuts: [
        { key: "Tab", label: "Switch Focus" },
        NAVIGATE_SHORTCUT,
        { key: "Enter", label: "Select Date" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: BACK_SHORTCUTS,
    };
  }

  if (focusZone === "insights") {
    return {
      shortcuts: [
        { key: "Tab", label: "Switch Focus" },
        { key: "Enter", label: "Open Review" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: BACK_SHORTCUTS,
    };
  }

  return {
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      NAVIGATE_SHORTCUT,
      { key: "Enter", label: "Open Review" },
      { key: "o", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: BACK_SHORTCUTS,
  };
}
