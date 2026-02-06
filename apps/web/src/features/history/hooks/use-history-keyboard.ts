import { type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useScope, useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import type { HistoryFocusZone } from "@/features/history/types";

const HISTORY_FOOTER_SHORTCUTS = [
  { key: "Tab", label: "Switch Focus" },
  { key: "Enter", label: "Expand" },
  { key: "o", label: "Open" },
];

const HISTORY_FOOTER_RIGHT_SHORTCUTS = [
  { key: "r", label: "Resume" },
  { key: "e", label: "Export" },
  { key: "Esc", label: "Back" },
];

const FOCUS_LEFT: Record<HistoryFocusZone, HistoryFocusZone | null> = {
  timeline: null,
  runs: "timeline",
  insights: "runs",
  search: "insights",
};

const FOCUS_RIGHT: Record<HistoryFocusZone, HistoryFocusZone | null> = {
  timeline: "runs",
  runs: "insights",
  insights: "search",
  search: null,
};

interface UseHistoryKeyboardOptions {
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  selectedRunId: string | null;
  expandedRunId: string | null;
  setExpandedRunId: (id: string | null) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function useHistoryKeyboard({
  focusZone,
  setFocusZone,
  selectedRunId,
  expandedRunId,
  setExpandedRunId,
  searchInputRef,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();

  useScope("history");

  useKey("Tab", () => {
    const zones: HistoryFocusZone[] = ["search", "timeline", "runs", "insights"];
    setFocusZone(zones[(zones.indexOf(focusZone) + 1) % zones.length]);
  });

  useKey("ArrowLeft", () => {
    const next = FOCUS_LEFT[focusZone];
    if (next) setFocusZone(next);
  });

  useKey("ArrowRight", () => {
    const next = FOCUS_RIGHT[focusZone];
    if (next) setFocusZone(next);
  });

  useKey("/", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  }, { enabled: focusZone !== "search" });

  const navigateToSelectedRun = () => {
    if (selectedRunId) {
      navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
    }
  };

  useKey("o", navigateToSelectedRun, { enabled: focusZone === "runs" });
  useKey(" ", navigateToSelectedRun, { enabled: focusZone === "runs" });

  useKey("Escape", () => {
    if (expandedRunId) {
      setExpandedRunId(null);
    } else {
      navigate({ to: "/" });
    }
  });

  usePageFooter({
    shortcuts: HISTORY_FOOTER_SHORTCUTS,
    rightShortcuts: HISTORY_FOOTER_RIGHT_SHORTCUTS,
  });
}
