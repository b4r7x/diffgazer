import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useTabNavigation } from "./use-tab-navigation";

function makeIssue(id: string, patch = true): ReviewIssue {
  const issue: ReviewIssue = {
    id,
    severity: "high",
    category: "correctness",
    title: id,
    file: "src/example.ts",
    line_start: 1,
    line_end: 1,
    rationale: "rationale",
    recommendation: "recommendation",
    confidence: 0.9,
    symptom: "symptom",
    whyItMatters: "impact",
    evidence: [],
    trace: [],
  };
  if (patch) issue.suggested_patch = "diff --git a/src/example.ts b/src/example.ts";
  return issue;
}

describe("useTabNavigation", () => {
  it("derives a valid tab when the selected issue has no patch", () => {
    const issueWithPatch = makeIssue("issue-with-patch");
    const issueWithoutPatch = makeIssue("issue-without-patch", false);
    const { result, rerender } = renderHook(
      ({ selectedIssue }) => useTabNavigation({ selectedIssue }),
      { initialProps: { selectedIssue: issueWithPatch } },
    );

    act(() => result.current.setActiveTab("patch"));
    expect(result.current.activeTab).toBe("patch");

    rerender({ selectedIssue: issueWithoutPatch });
    expect(result.current.availableTabs).toEqual(["details", "explain", "trace"]);
    expect(result.current.activeTab).toBe("details");

    act(() => result.current.setActiveTab("patch"));
    expect(result.current.activeTab).toBe("details");
  });

  it("keeps completed fix-plan steps scoped to the selected issue", () => {
    const issueA = makeIssue("issue-a");
    const issueB = makeIssue("issue-b");
    const { result, rerender } = renderHook(
      ({ selectedIssue }) => useTabNavigation({ selectedIssue }),
      { initialProps: { selectedIssue: issueA } },
    );

    act(() => result.current.handleToggleStep(2));
    expect(result.current.completedSteps.has(2)).toBe(true);

    rerender({ selectedIssue: issueB });
    expect(result.current.completedSteps.has(1)).toBe(true);
    expect(result.current.completedSteps.has(2)).toBe(false);

    act(() => result.current.handleToggleStep(3));
    expect(result.current.completedSteps.has(3)).toBe(true);

    rerender({ selectedIssue: issueA });
    expect(result.current.completedSteps.has(2)).toBe(true);
    expect(result.current.completedSteps.has(3)).toBe(false);
  });
});
