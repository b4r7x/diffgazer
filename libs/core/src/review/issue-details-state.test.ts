/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewIssue } from "../schemas/review/index.js";
import { makeIssue } from "../testing/factories.js";
import {
  clampIssueTab,
  getAvailableIssueTabs,
  toggleFixPlanStep,
  useIssueDetailsState,
} from "./issue-details-state.js";

function createReviewIssue(
  id: string,
  opts: { withPatch?: boolean; withTrace?: boolean } = {},
): ReviewIssue {
  return makeIssue({
    id,
    title: `Issue ${id}`,
    file: "src/a.ts",
    line_start: 1,
    line_end: null,
    rationale: "desc",
    recommendation: "fix",
    suggested_patch: opts.withPatch ? "--- a\n+++ b" : null,
    confidence: 0.9,
    symptom: "symptom",
    whyItMatters: "matters",
    evidence: [],
    ...(opts.withTrace
      ? {
          trace: [
            {
              step: 1,
              tool: "generateAnalysis",
              inputSummary: "in",
              outputSummary: "out",
              timestamp: "2025-01-01T00:00:00Z",
            },
          ],
        }
      : {}),
  });
}

describe("getAvailableIssueTabs", () => {
  it("advertises no issue tabs without a selected issue", () => {
    expect(getAvailableIssueTabs(null)).toEqual([]);
  });

  it("omits patch and trace tabs when the issue has neither", () => {
    expect(getAvailableIssueTabs(createReviewIssue("a"))).toEqual(["details", "explain"]);
  });

  it("omits the trace tab when the trace array is empty", () => {
    expect(getAvailableIssueTabs({ ...createReviewIssue("a"), trace: [] })).toEqual([
      "details",
      "explain",
    ]);
  });

  it("includes the trace tab only when trace steps exist", () => {
    expect(getAvailableIssueTabs(createReviewIssue("a", { withTrace: true }))).toEqual([
      "details",
      "explain",
      "trace",
    ]);
  });

  it("includes the patch tab when a suggested patch exists", () => {
    expect(getAvailableIssueTabs(createReviewIssue("a", { withPatch: true }))).toEqual([
      "details",
      "explain",
      "patch",
    ]);
  });

  it("omits the patch tab for a whitespace-only patch", () => {
    expect(
      getAvailableIssueTabs({ ...createReviewIssue("a"), suggested_patch: "   \n\t " }),
    ).toEqual(["details", "explain"]);
  });

  it("keeps a patch whose surrounding whitespace is part of the diff", () => {
    expect(
      getAvailableIssueTabs({ ...createReviewIssue("a"), suggested_patch: "  -old\n  +new\n" }),
    ).toEqual(["details", "explain", "patch"]);
  });
});

describe("clampIssueTab", () => {
  it("keeps an available tab", () => {
    expect(clampIssueTab("explain", ["details", "explain", "trace"])).toBe("explain");
  });

  it("falls back to details when the tab is unavailable", () => {
    expect(clampIssueTab("patch", ["details", "explain", "trace"])).toBe("details");
  });
});

describe("toggleFixPlanStep", () => {
  it("toggles a step without mutating the input", () => {
    const input = new Set([1]);
    expect([...toggleFixPlanStep(input, 2)].sort()).toEqual([1, 2]);
    expect([...toggleFixPlanStep(input, 1)]).toEqual([]);
    expect([...input]).toEqual([1]);
  });
});

describe("useIssueDetailsState", () => {
  it("starts fix-plan progress empty for a fresh issue", () => {
    const { result } = renderHook((issue: ReviewIssue) => useIssueDetailsState(issue), {
      initialProps: createReviewIssue("a"),
    });
    expect(result.current.completedSteps.size).toBe(0);
  });

  it("persists fix-plan progress per issue across switches", () => {
    const issueA = createReviewIssue("a");
    const issueB = createReviewIssue("b");
    const { result, rerender } = renderHook((issue: ReviewIssue) => useIssueDetailsState(issue), {
      initialProps: issueA,
    });

    act(() => result.current.toggleStep(1));
    expect([...result.current.completedSteps]).toEqual([1]);

    rerender(issueB);
    expect(result.current.completedSteps.size).toBe(0);

    rerender(issueA);
    expect([...result.current.completedSteps]).toEqual([1]);
  });

  it("tracks reserved-key issue ids independently across switches", () => {
    const protoIssue = createReviewIssue("__proto__");
    const constructorIssue = createReviewIssue("constructor");
    const { result, rerender } = renderHook((issue: ReviewIssue) => useIssueDetailsState(issue), {
      initialProps: protoIssue,
    });

    act(() => result.current.toggleStep(1));
    expect([...result.current.completedSteps]).toEqual([1]);

    rerender(constructorIssue);
    expect(result.current.completedSteps.size).toBe(0);

    act(() => result.current.toggleStep(2));
    expect([...result.current.completedSteps]).toEqual([2]);

    rerender(protoIssue);
    expect([...result.current.completedSteps]).toEqual([1]);

    rerender(constructorIssue);
    expect([...result.current.completedSteps]).toEqual([2]);
  });

  it("returns a new completed-steps reference after toggle", () => {
    const { result } = renderHook(() => useIssueDetailsState(createReviewIssue("a")));
    const before = result.current.completedSteps;

    act(() => result.current.toggleStep(1));

    expect(result.current.completedSteps).not.toBe(before);
    expect([...result.current.completedSteps]).toEqual([1]);
  });

  it("keeps the requested tab across issue switches, clamping when unavailable", () => {
    const withPatch = createReviewIssue("a", { withPatch: true });
    const noPatch = createReviewIssue("b");
    const { result, rerender } = renderHook((issue: ReviewIssue) => useIssueDetailsState(issue), {
      initialProps: withPatch,
    });

    act(() => result.current.setActiveTab("patch"));
    expect(result.current.activeTab).toBe("patch");

    rerender(noPatch);
    expect(result.current.activeTab).toBe("details");

    rerender(withPatch);
    expect(result.current.activeTab).toBe("patch");
  });

  it("rejects Trace but accepts Patch for a patch-only issue", () => {
    const patchOnly = createReviewIssue("a", { withPatch: true });
    const { result } = renderHook((issue: ReviewIssue) => useIssueDetailsState(issue), {
      initialProps: patchOnly,
    });

    act(() => result.current.setActiveTab("trace"));
    expect(result.current.activeTab).toBe("details");

    act(() => result.current.setActiveTab("patch"));
    expect(result.current.activeTab).toBe("patch");
  });
});
