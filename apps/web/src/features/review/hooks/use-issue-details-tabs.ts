import { useIssueDetailsState } from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useRef } from "react";

interface UseIssueDetailsTabsOptions {
  selectedIssue: ReviewIssue | null;
}

export function useIssueDetailsTabs({ selectedIssue }: UseIssueDetailsTabsOptions) {
  const { activeTab, availableTabs, setActiveTab, completedSteps, toggleStep } =
    useIssueDetailsState(selectedIssue);
  const detailsScrollRef = useRef<HTMLDivElement>(null);

  const moveTab = (delta: -1 | 1) => {
    const index = availableTabs.indexOf(activeTab);
    if (index < 0) return "no-change" as const;
    const nextIndex = index + delta;

    if (nextIndex < 0) return "boundary-left" as const;
    if (nextIndex >= availableTabs.length) return "boundary-right" as const;
    const nextTab = availableTabs[nextIndex];
    if (nextTab === undefined) return "no-change" as const;
    setActiveTab(nextTab);
    return "moved" as const;
  };

  const scrollDetails = (delta: number) => {
    detailsScrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  return {
    activeTab,
    setActiveTab,
    availableTabs,
    completedSteps,
    handleToggleStep: toggleStep,
    detailsScrollRef,
    moveTab,
    scrollDetails,
  };
}
