import { useRef, useState } from "react";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { IssueTab as TabId } from "@diffgazer/schemas/ui";

interface UseTabNavigationOptions {
  selectedIssue: ReviewIssue | null;
}

export function useTabNavigation({ selectedIssue }: UseTabNavigationOptions) {
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );
  const detailsScrollRef = useRef<HTMLDivElement>(null);

  const availableTabs: TabId[] = selectedIssue?.suggested_patch
    ? ["details", "explain", "trace", "patch"]
    : ["details", "explain", "trace"];

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
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
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
