import { type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFocusZone, useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import type { HistoryFocusZone } from "@/features/history/types";

const ZONES = ["timeline", "runs", "search"] as const;
type KeyboardHistoryFocusZone = (typeof ZONES)[number];

interface UseHistoryKeyboardOptions {
  focusZone: HistoryFocusZone;
  setFocusZone: (zone: HistoryFocusZone) => void;
  selectedRunId: string | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
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

  return {
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter/Space", label: "Open Review" },
      { key: "o", label: "Open Review" },
      { key: "/", label: "Search" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  };
}

export function useHistoryKeyboard({
  focusZone,
  setFocusZone,
  selectedRunId,
  searchInputRef,
}: UseHistoryKeyboardOptions) {
  const navigate = useNavigate();
  const effectiveZone: KeyboardHistoryFocusZone = focusZone === "insights" ? "runs" : focusZone;

  useFocusZone({
    initial: "runs",
    zones: ZONES,
    zone: effectiveZone,
    onZoneChange: (zone) => setFocusZone(zone),
    scope: "history",
    tabCycle: ["search", "timeline", "runs"],
    transitions: ({ zone, key }) => {
      const left: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        timeline: null,
        runs: "timeline",
        search: "runs",
      };
      const right: Record<KeyboardHistoryFocusZone, KeyboardHistoryFocusZone | null> = {
        timeline: "runs",
        runs: null,
        search: null,
      };
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

  const { shortcuts, rightShortcuts } = getHistoryFooter(focusZone);

  usePageFooter({
    shortcuts,
    rightShortcuts,
  });
}
