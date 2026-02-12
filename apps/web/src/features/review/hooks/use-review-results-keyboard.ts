import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { SeverityFilter } from "@/features/review/components/severity-filter-group";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { Shortcut } from "@diffgazer/schemas/ui";
import type { IssueTab as TabId } from "@diffgazer/schemas/ui";
import { SEVERITY_ORDER } from "@diffgazer/schemas/ui";
import { useFocusZone, useKey, useNavigation } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { filterIssuesBySeverity } from "@diffgazer/core/review";

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
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const detailsScrollRef = useRef<HTMLDivElement>(null);

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

  // Ensure selectedIssueId is valid for current filtered list
  const effectiveSelectedId = filteredIssues.some(i => i.id === selectedIssueId)
    ? selectedIssueId
    : filteredIssues[0]?.id ?? null;

  const { focusedValue } = useNavigation({
    containerRef: listRef,
    role: "option",
    enabled: focusZone === "list",
    value: effectiveSelectedId,
    onValueChange: setSelectedIssueId,
    wrap: false,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
    onBoundaryReached: (direction) => {
      if (direction === "up") setFocusZone("filters");
    },
  });

  const { forZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ZONES,
    zone: focusZone,
    onZoneChange: setFocusZone,
    scope: "review",
    tabCycle: ["filters", "list", "details"],
    transitions: ({ zone, key }) => {
      if (zone === "list" && key === "ArrowRight") return "details";
      if (zone === "filters" && key === "ArrowDown") return "list";
      return null;
    },
  });

  const selectedIssue = filteredIssues.find(i => i.id === effectiveSelectedId) ?? null;

  const handleBack = () => router.history.back();

  useKey("Escape", handleBack);

  const handleToggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  };

  // Filters zone
  useKey({
    ArrowLeft: () => {
      if (focusedFilterIndex > 0) setFocusedFilterIndex((i) => i - 1);
    },
    ArrowRight: () => {
      if (focusedFilterIndex < SEVERITY_ORDER.length - 1) {
        setFocusedFilterIndex((i) => i + 1);
      } else {
        setFocusZone("details");
      }
    },
    " ": handleToggleSeverityFilter,
  }, forZone("filters", { preventDefault: true }));

  useKey({
    j: () => setFocusZone("list"),
    Enter: handleToggleSeverityFilter,
  }, forZone("filters"));

  // Details zone
  const availableTabs: TabId[] = selectedIssue?.suggested_patch
    ? ["details", "explain", "trace", "patch"]
    : ["details", "explain", "trace"];

  const moveTab = (delta: -1 | 1) => {
    const index = availableTabs.indexOf(activeTab);
    if (index < 0) return;
    const nextIndex = index + delta;

    if (nextIndex < 0) {
      setFocusZone("list");
      return;
    }
    if (nextIndex >= availableTabs.length) return;
    setActiveTab(availableTabs[nextIndex]);
  };

  const scrollDetails = (delta: number) => {
    detailsScrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  useKey({
    ArrowLeft: () => moveTab(-1),
    ArrowRight: () => moveTab(1),
    ArrowUp: () => scrollDetails(-80),
    ArrowDown: () => scrollDetails(80),
  }, forZone("details", { preventDefault: true }));

  useKey({
    "1": () => setActiveTab("details"),
    "2": () => setActiveTab("explain"),
    "3": () => setActiveTab("trace"),
  }, forZone("details"));

  useKey("4", () => setActiveTab("patch"), forZone("details", {
    enabled: !!selectedIssue?.suggested_patch,
  }));

  const handleToggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const footer = getReviewResultsFooter(
    focusZone,
    Boolean(selectedIssue?.suggested_patch),
  );

  usePageFooter({ shortcuts: footer.shortcuts, rightShortcuts: footer.rightShortcuts });

  return {
    filteredIssues,
    selectedIssue,
    selectedIssueId: effectiveSelectedId,
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
