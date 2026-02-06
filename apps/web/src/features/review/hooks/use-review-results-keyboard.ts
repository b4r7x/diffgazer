import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { SeverityFilter } from "@/features/review/components/severity-filter-group";
import type { ReviewIssue } from "@stargazer/schemas/review";
import type { IssueTab as TabId } from "@stargazer/schemas/ui";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScope, useKey, useSelectableList } from "@/hooks/keyboard";
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

interface UseReviewResultsKeyboardOptions {
  issues: ReviewIssue[];
}

export function useReviewResultsKeyboard({ issues }: UseReviewResultsKeyboardOptions) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

  const { focusedIndex, setFocusedIndex } = useSelectableList({
    itemCount: filteredIssues.length,
    wrap: false,
    enabled: focusZone === "list",
    initialIndex: 0,
  });

  const selectedIssue = filteredIssues[focusedIndex] ?? null;

  const handleBack = () => router.history.back();

  useScope("review");
  useKey("Escape", handleBack, { enabled: focusZone === "list" });

  useKey("Tab", () => {
    if (focusZone === "filters") setFocusZone("list");
    else if (focusZone === "list") setFocusZone("details");
    else setFocusZone("filters");
  });

  useKey("ArrowLeft", () => {
    if (focusZone === "details") setFocusZone("list");
    else if (focusZone === "filters" && focusedFilterIndex > 0) {
      setFocusedFilterIndex((i) => i - 1);
    }
  });

  useKey("ArrowRight", () => {
    if (focusZone === "list") setFocusZone("details");
    else if (focusZone === "filters") {
      if (focusedFilterIndex < SEVERITY_ORDER.length - 1) {
        setFocusedFilterIndex((i) => i + 1);
      } else {
        setFocusZone("details");
      }
    }
  });

  useKey(
    "ArrowUp",
    () => {
      if (focusZone === "list" && focusedIndex === 0) {
        setFocusZone("filters");
      }
    },
    { enabled: focusZone === "list" },
  );

  useKey("ArrowDown", () => setFocusZone("list"), {
    enabled: focusZone === "filters",
  });
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
