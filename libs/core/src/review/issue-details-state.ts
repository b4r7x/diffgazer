import { useState } from "react";
import { ISSUE_TABS, type IssueTab } from "../schemas/presentation/issue-tabs.js";
import { hasSuggestedPatch, type ReviewIssue } from "../schemas/review/index.js";

/**
 * The tabs available for an issue: the patch tab only when a patch exists, and
 * the trace tab only when the issue carries trace steps — so the permanently
 * empty trace tab disappears and tab-cycling skips it.
 */
export function getAvailableIssueTabs(issue: ReviewIssue | null | undefined): IssueTab[] {
  if (!issue) return [];
  return ISSUE_TABS.filter((tab) => {
    if (tab === "patch") return hasSuggestedPatch(issue);
    if (tab === "trace") return Boolean(issue.trace?.length);
    return true;
  });
}

/** Clamps a requested tab to one that is currently available, else "details". */
export function clampIssueTab(requested: IssueTab, available: IssueTab[]): IssueTab {
  return available.includes(requested) ? requested : "details";
}

export function toggleFixPlanStep(completed: ReadonlySet<number>, step: number): Set<number> {
  const next = new Set(completed);
  if (next.has(step)) next.delete(step);
  else next.add(step);
  return next;
}

const EMPTY_COMPLETED_STEPS: ReadonlySet<number> = new Set<number>();

export interface IssueDetailsState {
  activeTab: IssueTab;
  availableTabs: IssueTab[];
  setActiveTab: (tab: IssueTab) => void;
  completedSteps: ReadonlySet<number>;
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
  const [completedByIssue, setCompletedByIssue] = useState<Map<string, ReadonlySet<number>>>(
    () => new Map(),
  );

  const availableTabs = getAvailableIssueTabs(selectedIssue);
  const activeTab = clampIssueTab(requestedTab, availableTabs);

  const setActiveTab = (tab: IssueTab) => {
    setRequestedTab(clampIssueTab(tab, availableTabs));
  };

  const completedSteps = selectedIssue
    ? (completedByIssue.get(selectedIssue.id) ?? EMPTY_COMPLETED_STEPS)
    : EMPTY_COMPLETED_STEPS;

  const toggleStep = (step: number) => {
    if (!selectedIssue) return;
    const issueId = selectedIssue.id;
    setCompletedByIssue((prev) => {
      const next = new Map(prev);
      next.set(issueId, toggleFixPlanStep(prev.get(issueId) ?? EMPTY_COMPLETED_STEPS, step));
      return next;
    });
  };

  return { activeTab, availableTabs, setActiveTab, completedSteps, toggleStep };
}
