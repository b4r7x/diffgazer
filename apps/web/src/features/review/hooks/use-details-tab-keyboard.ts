import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useKey } from "@diffgazer/keys";
import { useState } from "react";

interface UseReviewDetailsTabKeyboardOptions {
  scope: string;
  enabled: boolean;
  selectedIssue: ReviewIssue | null;
  activeTab: IssueTab;
  moveTab: (delta: -1 | 1) => "no-change" | "boundary-left" | "boundary-right" | "moved";
  scrollDetails: (delta: number) => void;
  setActiveTab: (tab: IssueTab) => void;
  enterList: () => void;
  onToggleStep: (step: number) => void;
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
    const step = fixPlan[focusedStepIndex];
    if (step) onToggleStep(step.step);
  };

  const setFocusedStepIndex = (index: number) => {
    setRawFocusedStep({ issueId: selectedIssueId, index });
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
    },
    { scope, enabled },
  );
  useKey("ArrowRight", () => moveTab(1), { scope, enabled: enabled && hasIssue });

  // j/k move the focused fix-plan step; Space/Enter toggle it. Arrows stay bound
  // to detail-body scrolling so the rest of the details content remains reachable.
  useKey("k", () => setFocusedStepIndex(Math.max(0, focusedStepIndex - 1)), {
    scope,
    enabled: stepsActive,
  });
  useKey("j", () => setFocusedStepIndex(Math.min(fixPlan.length - 1, focusedStepIndex + 1)), {
    scope,
    enabled: stepsActive,
  });
  useKey([" ", "Enter"], toggleFocusedStep, {
    scope,
    enabled: stepsActive,
    preventDefault: true,
  });

  useKey("ArrowUp", () => scrollDetails(-80), { scope, enabled, preventDefault: true });
  useKey("ArrowDown", () => scrollDetails(80), { scope, enabled, preventDefault: true });

  useKey("1", () => setActiveTab("details"), { scope, enabled: enabled && hasIssue });
  useKey("2", () => setActiveTab("explain"), { scope, enabled: enabled && hasIssue });
  useKey("3", () => setActiveTab("trace"), {
    scope,
    enabled: enabled && hasIssue && Boolean(selectedIssue.trace?.length),
  });
  useKey("4", () => setActiveTab("patch"), {
    scope,
    enabled: enabled && hasIssue && !!selectedIssue.suggested_patch,
  });

  return {
    focusedStepIndex: stepsActive ? focusedStepIndex : null,
    setFocusedStepIndex,
  };
}
