import {
  BACK_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  type Shortcut,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import type { HistoryDetailState } from "../types";
import type { HistoryInteractionMode } from "./run-mapping";

export interface HistoryFooter {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

const CLEAR: Shortcut[] = [{ key: "Esc", label: "Clear Search" }];

export function getHistoryFooter(
  focusZone: HistoryInteractionMode,
  reviewDetailStatus: HistoryDetailState["status"] = "ready",
): HistoryFooter {
  if (focusZone === "route") {
    return { shortcuts: [], rightShortcuts: BACK_SHORTCUTS };
  }
  if (focusZone === "search") {
    return {
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: CLEAR,
    };
  }

  if (focusZone === "timeline") {
    return {
      shortcuts: [SWITCH_PANE_SHORTCUT, NAVIGATE_SHORTCUT, { key: "/", label: "Search" }],
      rightShortcuts: BACK_SHORTCUTS,
    };
  }

  if (focusZone === "insights") {
    const shortcuts: Shortcut[] = [SWITCH_PANE_SHORTCUT];
    if (reviewDetailStatus === "ready") {
      shortcuts.push({ key: "Enter", label: "Open Review" });
    }
    shortcuts.push({ key: "/", label: "Search" });
    if (reviewDetailStatus === "error") {
      shortcuts.push({ key: "r", label: "Retry Details" });
    }

    return {
      shortcuts,
      rightShortcuts: BACK_SHORTCUTS,
    };
  }

  return {
    shortcuts: [
      SWITCH_PANE_SHORTCUT,
      NAVIGATE_SHORTCUT,
      { key: "Enter", label: "Open Review" },
      { key: "o", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: BACK_SHORTCUTS,
  };
}
