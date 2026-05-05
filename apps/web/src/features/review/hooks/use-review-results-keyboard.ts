import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { useFocusZone, useKey } from "@diffgazer/keys";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useSeverityFilter } from "./use-severity-filter.js";
import { useIssueSelection } from "./use-issue-selection.js";
import { useTabNavigation } from "./use-tab-navigation.js";

type FocusZone = "filters" | "list" | "details";

const ZONES = ["filters", "list", "details"] as const;

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
}

export function getReviewResultsFooter(
  focusZone: FocusZone,
  canUsePatchTab: boolean,
): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  if (focusZone === "filters") {
    return {
      shortcuts: [
        { key: "←/→", label: "Move Filter" },
        { key: "Enter/Space", label: "Toggle Filter" },
        { key: "j", label: "Issue List" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  if (focusZone === "details") {
    return {
      shortcuts: [
        { key: canUsePatchTab ? "1-4" : "1-3", label: "Switch Tab" },
        { key: "←", label: "Issue List" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    };
  }

  return {
    shortcuts: [
      { key: "j/k", label: "Select Issue" },
      { key: "→", label: "Issue Details" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  };
}

export function useReviewResultsKeyboard({ issues }: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const [focusZone, setFocusZone] = useState<FocusZone>("list");

  const { severityFilter, setSeverityFilter, filteredIssues, focusedFilterIndex, toggleSeverityFilter, moveFocusedFilter } =
    useSeverityFilter({ issues });

  const { selectedIssue, selectedIssueId, setSelectedIssueId, focusedValue, listRef, moveIssue } =
    useIssueSelection({ filteredIssues });

  const { activeTab, setActiveTab, completedSteps, handleToggleStep, detailsScrollRef, moveTab, scrollDetails } =
    useTabNavigation({ selectedIssue });

  // Key bindings registered in the same order as the original monolithic hook.
  // Registration order matters in @diffgazer/keys; do not reorder.

  useFocusZone({
    initial: "list" as FocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: "review",
    tabCycle: ["filters", "list", "details"],
    transitions: ({ zone, key }) => {
      if (zone === "list" && key === "ArrowRight") return "details";
      if (zone === "filters" && key === "ArrowRight" && focusedFilterIndex >= SEVERITY_ORDER.length - 1) return "details";
      if (zone === "filters" && key === "ArrowDown") return "list";
      return null;
    },
  });

  const handleMoveIssue = (delta: -1 | 1) => {
    const result = moveIssue(delta);
    if (result === "boundary-top") setFocusZone("filters");
  };

  useKey("ArrowDown", () => handleMoveIssue(1), { enabled: focusZone === "list" });
  useKey("ArrowUp", () => handleMoveIssue(-1), { enabled: focusZone === "list" });
  useKey("j", () => handleMoveIssue(1), { enabled: focusZone === "list" });
  useKey("k", () => handleMoveIssue(-1), { enabled: focusZone === "list" });

  useKey("Escape", () => router.history.back());

  useKey("ArrowLeft", () => moveFocusedFilter(-1), { enabled: focusZone === "filters" });
  useKey("ArrowRight", () => moveFocusedFilter(1), { enabled: focusZone === "filters" });

  useKey("j", () => setFocusZone("list"), { enabled: focusZone === "filters" });

  useKey("ArrowLeft", () => {
    const result = moveTab(-1);
    if (result === "boundary-left") setFocusZone("list");
  }, { enabled: focusZone === "details" });
  useKey("ArrowRight", () => moveTab(1), { enabled: focusZone === "details" });

  useKey("ArrowUp", () => scrollDetails(-80), { enabled: focusZone === "details" });
  useKey("ArrowDown", () => scrollDetails(80), { enabled: focusZone === "details" });

  useKey("Enter", toggleSeverityFilter, { enabled: focusZone === "filters" });
  useKey(" ", toggleSeverityFilter, { enabled: focusZone === "filters" });

  useKey("1", () => setActiveTab("details"), { enabled: focusZone === "details" });
  useKey("2", () => setActiveTab("explain"), { enabled: focusZone === "details" });
  useKey("3", () => setActiveTab("trace"), { enabled: focusZone === "details" });
  useKey("4", () => setActiveTab("patch"), { enabled: focusZone === "details" && !!selectedIssue?.suggested_patch });

  const footer = getReviewResultsFooter(
    focusZone,
    Boolean(selectedIssue?.suggested_patch),
  );

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  return {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    setSelectedIssueId,
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    focusZone,
    focusedFilterIndex,
    focusedValue,
    listRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
  };
}
