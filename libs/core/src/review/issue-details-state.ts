import { useState } from "react";
import { ISSUE_TABS, type IssueTab } from "../schemas/presentation/issue-tabs.js";
import type { ReviewIssue } from "../schemas/review/index.js";

/**
 * The tabs available for an issue: the patch tab only when a patch exists, and
 * the trace tab only when the issue carries trace steps — so the permanently
 * empty trace tab disappears and tab-cycling skips it.
 */
export function getAvailableIssueTabs(issue: ReviewIssue | null | undefined): IssueTab[] {
  if (!issue) return [];
  return ISSUE_TABS.filter((tab) => {
    if (tab === "patch") return Boolean(issue.suggested_patch);
    if (tab === "trace") return Boolean(issue.trace?.length);
    return true;
  });
}

/** Clamps a requested tab to one that is currently available, else "details". */
export function clampIssueTab(requested: IssueTab, available: IssueTab[]): IssueTab {
  return available.includes(requested) ? requested : "details";
}

/** Toggles a fix-plan step in a completed-steps set, returning a new set. */
export function toggleFixPlanStep(completed: Set<number>, step: number): Set<number> {
  const next = new Set(completed);
  if (next.has(step)) next.delete(step);
  else next.add(step);
  return next;
}

const EMPTY_COMPLETED_STEPS: Set<number> = new Set<number>();

export interface IssueDetailsState {
  activeTab: IssueTab;
  availableTabs: IssueTab[];
  setActiveTab: (tab: IssueTab) => void;
  completedSteps: Set<number>;
  toggleStep: (step: number) => void;
}

/**
 * The canonical issue-details state model shared by both surfaces: the requested
 * tab persists across issue switches (clamped to availability), and fix-plan
 * progress is stored per issue starting from an EMPTY completed set.
 */
export function useIssueDetailsState(
  selectedIssue: ReviewIssue | null | undefined,
): IssueDetailsState {
  const [requestedTab, setRequestedTab] = useState<IssueTab>("details");
  const [completedByIssue, setCompletedByIssue] = useState<Record<string, Set<number>>>({});

  const availableTabs = getAvailableIssueTabs(selectedIssue);
  const activeTab = clampIssueTab(requestedTab, availableTabs);

  const setActiveTab = (tab: IssueTab) => {
    setRequestedTab(clampIssueTab(tab, availableTabs));
  };

  const completedSteps = selectedIssue
    ? (completedByIssue[selectedIssue.id] ?? EMPTY_COMPLETED_STEPS)
    : EMPTY_COMPLETED_STEPS;

  const toggleStep = (step: number) => {
    if (!selectedIssue) return;
    const issueId = selectedIssue.id;
    setCompletedByIssue((prev) => ({
      ...prev,
      [issueId]: toggleFixPlanStep(prev[issueId] ?? new Set<number>(), step),
    }));
  };

  return { activeTab, availableTabs, setActiveTab, completedSteps, toggleStep };
}
