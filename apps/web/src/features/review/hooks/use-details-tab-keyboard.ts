import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { clampIndex, composedClosest, focusNavigationItem, useKey } from "@diffgazer/keys";
import { type RefObject, useState } from "react";
import { FIX_PLAN_CHECKLIST_SELECTOR } from "../components/fix-plan-checklist";
import { PATCH_DIFF_REGION_SELECTOR } from "../components/issue-details-pane/patch";
import { isInteractiveTarget } from "../lib/interactive-target";

interface UseReviewDetailsTabKeyboardOptions {
  scope: string;
  enabled: boolean;
  selectedIssue: ReviewIssue | null;
  activeTab: IssueTab;
  /** Core's availability answer: the digit bindings must not re-derive it. */
  availableTabs: readonly IssueTab[];
  /** The details scroll body: it owns the tab content and parks focus across tab switches. */
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

  // Switching tabs hides the active tab content, which would drop DOM focus
  // held inside it (a checklist step, the patch diff region) to <body>; park it
  // on the details scroll body (it stays mounted across tab switches) so the
  // details zone keeps focus.
  const parkDetailsFocus = () => {
    const scrollBody = detailsScrollRef.current;
    if (!scrollBody) return;
    const active = scrollBody.ownerDocument.activeElement;
    if (active === scrollBody || !scrollBody.contains(active)) return;
    scrollBody.focus({ preventScroll: true });
  };

  const switchTab = (tab: IssueTab) => {
    if (tab !== activeTab) parkDetailsFocus();
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
      if (result === "moved") parkDetailsFocus();
    },
    { scope, enabled },
  );
  useKey(
    "ArrowRight",
    () => {
      if (moveTab(1) === "moved") parkDetailsFocus();
    },
    { scope, enabled: enabled && hasIssue },
  );

  // j/k move real DOM focus through the fix-plan step checkboxes (the visual
  // highlight follows through the checkbox focus mirror); Space/Enter toggle
  // the focused step. Vertical arrows step too while focus sits inside the
  // checklist (TUI parity) and keep scrolling the detail body from anywhere
  // else so the rest of the details content remains reachable.
  useKey("k", () => moveFocusedStep(-1), { scope, enabled: stepsActive });
  useKey("j", () => moveFocusedStep(1), { scope, enabled: stepsActive });
  useKey([" ", "Enter"], toggleFocusedStep, {
    scope,
    enabled: stepsActive,
    preventDefault: true,
  });

  const isChecklistTarget = (event: KeyboardEvent) => {
    if (!(event.target instanceof Element)) return false;
    const checklist = composedClosest(event.target, FIX_PLAN_CHECKLIST_SELECTOR);
    return checklist !== null && !!detailsScrollRef.current?.contains(checklist);
  };

  useKey(
    "ArrowUp",
    (event) => {
      if (stepsActive && isChecklistTarget(event)) moveFocusedStep(-1);
      else scrollDetails(-80);
    },
    { scope, enabled, preventDefault: true },
  );
  useKey(
    "ArrowDown",
    (event) => {
      if (stepsActive && isChecklistTarget(event)) moveFocusedStep(1);
      else scrollDetails(80);
    },
    { scope, enabled, preventDefault: true },
  );

  // The patch diff region advertises j/k/Home/End but only receives them once
  // focused; Enter hands it real DOM focus from anywhere in the details zone.
  useKey(
    "Enter",
    (event) => {
      if (isInteractiveTarget(event.target)) return;
      detailsScrollRef.current
        ?.querySelector<HTMLElement>(PATCH_DIFF_REGION_SELECTOR)
        ?.focus({ preventScroll: true });
    },
    { scope, enabled: enabled && hasIssue && activeTab === "patch" },
  );

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
