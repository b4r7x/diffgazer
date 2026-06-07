import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useKey } from "@diffgazer/keys";

interface UseReviewDetailsTabKeyboardOptions {
  scope: string;
  enabled: boolean;
  selectedIssue: ReviewIssue | null;
  moveTab: (delta: -1 | 1) => "no-change" | "boundary-left" | "boundary-right" | "moved";
  scrollDetails: (delta: number) => void;
  setActiveTab: (tab: IssueTab) => void;
  enterList: () => void;
}

/**
 * Details-zone key bindings for the review results screen: switching detail
 * tabs, scrolling the detail body, and moving focus back to the issue list.
 */
export function useReviewDetailsTabKeyboard({
  scope,
  enabled,
  selectedIssue,
  moveTab,
  scrollDetails,
  setActiveTab,
  enterList,
}: UseReviewDetailsTabKeyboardOptions) {
  const hasIssue = !!selectedIssue;

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

  useKey("ArrowUp", () => scrollDetails(-80), { scope, enabled });
  useKey("ArrowDown", () => scrollDetails(80), { scope, enabled });

  useKey("1", () => setActiveTab("details"), { scope, enabled: enabled && hasIssue });
  useKey("2", () => setActiveTab("explain"), { scope, enabled: enabled && hasIssue });
  useKey("3", () => setActiveTab("trace"), { scope, enabled: enabled && hasIssue });
  useKey("4", () => setActiveTab("patch"), {
    scope,
    enabled: enabled && hasIssue && !!selectedIssue.suggested_patch,
  });
}
