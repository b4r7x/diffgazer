import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { SeverityFilter } from "@/features/review/components/severity-filter-group";
import type { ReviewIssue } from "@stargazer/schemas/review";
import type { IssueTab as TabId } from "@stargazer/schemas/ui";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useFocusZone, useKey, useSelectableList } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { filterIssuesBySeverity } from "@stargazer/core/review";

const SHORTCUTS = [
  { key: "j/k", label: "Select" },
  { key: "←/→", label: "Navigate" },
  { key: "1-4", label: "Tab" },
];

const RIGHT_SHORTCUTS = [
  { key: "Space", label: "Toggle" },
  { key: "Esc", label: "Back" },
];

type FocusZone = "filters" | "list" | "details";

const ZONES = ["filters", "list", "details"] as const;

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
}

export function useReviewResultsKeyboard({ issues }: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );
  const [focusZone, setFocusZone] = useState<FocusZone>("list");

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

  const { focusedIndex, setFocusedIndex } = useSelectableList({
    itemCount: filteredIssues.length,
    wrap: false,
    enabled: focusZone === "list",
    initialIndex: 0,
  });

  useFocusZone({
    initial: "list" as FocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: "review",
    tabCycle: ["filters", "list", "details"],
    transitions: ({ zone, key }) => {
      if (zone === "details" && key === "ArrowLeft") return "list";
      if (zone === "list" && key === "ArrowRight") return "details";
      if (zone === "filters" && key === "ArrowRight" && focusedFilterIndex >= SEVERITY_ORDER.length - 1) return "details";
      if (zone === "filters" && key === "ArrowDown") return "list";
      if (zone === "list" && key === "ArrowUp" && focusedIndex === 0) return "filters";
      return null;
    },
  });

  const selectedIssue = filteredIssues[focusedIndex] ?? null;

  const handleBack = () => router.history.back();

  useKey("Escape", handleBack, { enabled: focusZone === "list" });

  useKey("ArrowLeft", () => {
    if (focusedFilterIndex > 0) setFocusedFilterIndex((i) => i - 1);
  }, { enabled: focusZone === "filters" });

  useKey("ArrowRight", () => {
    if (focusedFilterIndex < SEVERITY_ORDER.length - 1) {
      setFocusedFilterIndex((i) => i + 1);
    }
  }, { enabled: focusZone === "filters" });

  useKey("j", () => setFocusZone("list"), { enabled: focusZone === "filters" });

  const handleToggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  };

  useKey("Enter", handleToggleSeverityFilter, {
    enabled: focusZone === "filters",
  });
  useKey(" ", handleToggleSeverityFilter, { enabled: focusZone === "filters" });

  useKey("1", () => setActiveTab("details"), {
    enabled: focusZone === "details",
  });
  useKey("2", () => setActiveTab("explain"), {
    enabled: focusZone === "details",
  });
  useKey("3", () => setActiveTab("trace"), {
    enabled: focusZone === "details",
  });
  useKey("4", () => setActiveTab("patch"), {
    enabled: focusZone === "details" && !!selectedIssue?.suggested_patch,
  });

  const handleToggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  usePageFooter({ shortcuts: SHORTCUTS, rightShortcuts: RIGHT_SHORTCUTS });

  return {
    filteredIssues,
    selectedIssue,
    focusedIndex,
    setFocusedIndex,
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    focusZone,
    focusedFilterIndex,
    completedSteps,
    handleToggleStep,
  };
}
