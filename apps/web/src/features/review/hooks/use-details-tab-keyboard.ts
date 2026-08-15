import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { clampIndex, focusNavigationItem, useKey } from "@diffgazer/keys";
import { type RefObject, useState } from "react";
import { FIX_PLAN_CHECKLIST_SELECTOR } from "../components/fix-plan-checklist";

interface UseReviewDetailsTabKeyboardOptions {
  scope: string;
  enabled: boolean;
  selectedIssue: ReviewIssue | null;
  activeTab: IssueTab;
  /** Core's availability answer: the digit bindings must not re-derive it. */
  availableTabs: readonly IssueTab[];
  /** The details scroll body: it owns the checklist and parks focus across tab switches. */
  detailsScrollRef: RefObject<HTMLDivElement | null>;
  moveTab: (delta: -1 | 1) => "no-change" | "boundary-left" | "boundary-right" | "moved";
  scrollDetails: (delta: number) => void;
  setActiveTab: (tab: IssueTab) => void;
  enterList: () => void;
  onToggleStep: (stepIndex: number) => void;
}

interface UseReviewDetailsTabKeyboardResult {
  focusedStepIndex: number | null;
  setFocusedStepIndex: (index: number) => void;
}

interface FocusedStepState {
  issueId: string | null;
  index: number;
}

/**
 * Details-zone key bindings for the review results screen: switching detail
 * tabs, scrolling the detail body, navigating and toggling fix-plan steps, and
 * moving focus back to the issue list.
 */
export function useReviewDetailsTabKeyboard({
  scope,
  enabled,
  selectedIssue,
  activeTab,
  availableTabs,
  detailsScrollRef,
  moveTab,
  scrollDetails,
  setActiveTab,
  enterList,
  onToggleStep,
}: UseReviewDetailsTabKeyboardOptions): UseReviewDetailsTabKeyboardResult {
  const hasIssue = !!selectedIssue;
  const fixPlan = selectedIssue?.fixPlan ?? [];
  const stepsActive = enabled && hasIssue && activeTab === "details" && fixPlan.length > 0;
  const selectedIssueId = selectedIssue?.id ?? null;

  const [rawFocusedStep, setRawFocusedStep] = useState<FocusedStepState>({
    issueId: selectedIssueId,
    index: 0,
  });
  const issueChanged = rawFocusedStep.issueId !== selectedIssueId;
  if (issueChanged) {
    setRawFocusedStep({ issueId: selectedIssueId, index: 0 });
  }
  const rawFocusedStepIndex = issueChanged ? 0 : rawFocusedStep.index;
  // Derive the in-bounds focused step from raw state so a shrinking plan never
  // points past its last step (no effect-based clamping).
  const focusedStepIndex =
    fixPlan.length > 0 ? Math.min(rawFocusedStepIndex, fixPlan.length - 1) : 0;

  const toggleFocusedStep = () => {
    if (fixPlan[focusedStepIndex]) onToggleStep(focusedStepIndex);
  };

  const setFocusedStepIndex = (index: number) => {
    setRawFocusedStep({ issueId: selectedIssueId, index });
  };

  const findChecklist = () =>
    detailsScrollRef.current?.querySelector<HTMLElement>(FIX_PLAN_CHECKLIST_SELECTOR) ?? null;

  const moveFocusedStep = (direction: -1 | 1) => {
    const index = clampIndex(focusedStepIndex, direction, fixPlan.length, false);
    setFocusedStepIndex(index);
    focusNavigationItem(findChecklist(), {
      type: "checkbox",
      value: String(index),
      ownerSelector: null,
    });
  };

  // Switching tabs hides the checklist, which would drop a focused step's DOM
  // focus to <body>; park it on the details scroll body (it stays mounted
  // across tab switches) so the details zone keeps focus.
  const parkChecklistFocus = () => {
    const checklist = findChecklist();
    if (!checklist?.contains(checklist.ownerDocument.activeElement)) return;
    detailsScrollRef.current?.focus({ preventScroll: true });
  };

  const switchTab = (tab: IssueTab) => {
    if (tab !== activeTab) parkChecklistFocus();
    setActiveTab(tab);
  };

  useKey(
    "ArrowLeft",
    () => {
      if (!selectedIssue) {
        enterList();
        return;
      }

      const result = moveTab(-1);
      if (result === "boundary-left") enterList();
      if (result === "moved") parkChecklistFocus();
    },
    { scope, enabled },
  );
  useKey(
    "ArrowRight",
    () => {
      if (moveTab(1) === "moved") parkChecklistFocus();
    },
    { scope, enabled: enabled && hasIssue },
  );

  // j/k move real DOM focus through the fix-plan step checkboxes (the visual
  // highlight follows through the checkbox focus mirror); Space/Enter toggle
  // the focused step. Arrows stay bound to detail-body scrolling so the rest of
  // the details content remains reachable.
  useKey("k", () => moveFocusedStep(-1), { scope, enabled: stepsActive });
  useKey("j", () => moveFocusedStep(1), { scope, enabled: stepsActive });
  useKey([" ", "Enter"], toggleFocusedStep, {
    scope,
    enabled: stepsActive,
    preventDefault: true,
  });

  useKey("ArrowUp", () => scrollDetails(-80), { scope, enabled, preventDefault: true });
  useKey("ArrowDown", () => scrollDetails(80), { scope, enabled, preventDefault: true });

  useKey("1", () => switchTab("details"), { scope, enabled: enabled && hasIssue });
  useKey("2", () => switchTab("explain"), { scope, enabled: enabled && hasIssue });
  useKey("3", () => switchTab("trace"), {
    scope,
    enabled: enabled && hasIssue && availableTabs.includes("trace"),
  });
  useKey("4", () => switchTab("patch"), {
    scope,
    enabled: enabled && hasIssue && availableTabs.includes("patch"),
  });

  return {
    focusedStepIndex: stepsActive ? focusedStepIndex : null,
    setFocusedStepIndex,
  };
}
