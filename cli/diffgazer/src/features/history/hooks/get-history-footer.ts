import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { HistoryFocusZone } from "../types.js";

export interface HistoryFooter {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

const BACK: Shortcut[] = [{ key: "Esc", label: "Back" }];
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
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter", label: "Select Date" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: BACK,
    };
  }

  if (focusZone === "insights") {
    return {
      shortcuts: [
        { key: "Tab", label: "Switch Focus" },
        { key: "Enter", label: "Open Review" },
        { key: "/", label: "Search" },
      ],
      rightShortcuts: BACK,
    };
  }

  return {
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter", label: "Open Review" },
      { key: "o", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: BACK,
  };
}
