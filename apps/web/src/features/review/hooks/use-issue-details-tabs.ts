import { useRef, useState } from "react";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { IssueTab as TabId } from "@diffgazer/core/schemas/ui";

interface UseIssueDetailsTabsOptions {
  selectedIssue: ReviewIssue | null;
}

const DEFAULT_COMPLETED_STEPS: Set<number> = Object.freeze(new Set([1])) as Set<number>;
const EMPTY_COMPLETED_STEPS: Set<number> = Object.freeze(new Set<number>()) as Set<number>;

export function useIssueDetailsTabs({ selectedIssue }: UseIssueDetailsTabsOptions) {
  const [requestedTab, setRequestedTab] = useState<TabId>("details");
  const [completedStepsByIssue, setCompletedStepsByIssue] = useState<Record<string, Set<number>>>({});
  const detailsScrollRef = useRef<HTMLDivElement>(null);

  const availableTabs: TabId[] = selectedIssue?.suggested_patch
    ? ["details", "explain", "trace", "patch"]
    : ["details", "explain", "trace"];
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : "details";
  const completedSteps = selectedIssue
    ? completedStepsByIssue[selectedIssue.id] ?? DEFAULT_COMPLETED_STEPS
    : EMPTY_COMPLETED_STEPS;

  const setActiveTab = (tab: TabId) => {
    setRequestedTab(availableTabs.includes(tab) ? tab : "details");
  };

  const moveTab = (delta: -1 | 1) => {
    const index = availableTabs.indexOf(activeTab);
    if (index < 0) return "no-change" as const;
    const nextIndex = index + delta;

    if (nextIndex < 0) return "boundary-left" as const;
    if (nextIndex >= availableTabs.length) return "boundary-right" as const;
    setActiveTab(availableTabs[nextIndex]);
    return "moved" as const;
  };

  const scrollDetails = (delta: number) => {
    detailsScrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  const handleToggleStep = (step: number) => {
    if (!selectedIssue) return;

    const issueId = selectedIssue.id;
    setCompletedStepsByIssue((prev) => {
      const current = prev[issueId] ?? DEFAULT_COMPLETED_STEPS;
      const next = new Set(current);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return { ...prev, [issueId]: next };
    });
  };

  return {
    activeTab,
    setActiveTab,
    availableTabs,
    completedSteps,
    handleToggleStep,
    detailsScrollRef,
    moveTab,
    scrollDetails,
  };
}
