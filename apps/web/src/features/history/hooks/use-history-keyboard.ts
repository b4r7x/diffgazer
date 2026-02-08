import { type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFocusZone, useKey } from "@stargazer/keyboard";
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

const ZONES = ["timeline", "runs", "insights", "search"] as const;

interface UseHistoryKeyboardOptions {
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  selectedRunId: string | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function useHistoryKeyboard({
  focusZone,
  setFocusZone,
  selectedRunId,
  searchInputRef,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();

  useFocusZone({
    initial: "runs" as HistoryFocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: "history",
    tabCycle: ["search", "timeline", "runs", "insights"],
    transitions: ({ zone, key }) => {
      const left: Record<string, HistoryFocusZone | null> = { timeline: null, runs: "timeline", insights: "runs", search: "insights" };
      const right: Record<string, HistoryFocusZone | null> = { timeline: "runs", runs: "insights", insights: "search", search: null };
      if (key === "ArrowLeft") return left[zone] ?? null;
      if (key === "ArrowRight") return right[zone] ?? null;
      return null;
    },
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
    navigate({ to: "/" });
  });

  usePageFooter({
    shortcuts: HISTORY_FOOTER_SHORTCUTS,
    rightShortcuts: HISTORY_FOOTER_RIGHT_SHORTCUTS,
  });
}
