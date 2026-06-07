import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { describe, expect, test } from "vitest";
import { selectReviewScreenPhase } from "./review-phase";

function makeSavedData(opts: { id: string; durationMs?: number | null; issues?: ReviewIssue[] }) {
  return {
    review: {
      metadata: { id: opts.id, durationMs: opts.durationMs },
      result: { issues: opts.issues ?? [] },
    },
  };
}

describe("selectReviewScreenPhase", () => {
  test("no reviewId → streaming path", () => {
    const phase = selectReviewScreenPhase({
      reviewId: undefined,
      savedIsLoading: false,
      savedData: undefined,
    });
    expect(phase.kind).toBe("streaming");
  });

  test("reviewId + loading → loading-saved", () => {
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: true,
      savedData: undefined,
    });
    expect(phase.kind).toBe("loading-saved");
  });

  test("reviewId + loaded data → saved with mapped fields", () => {
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: false,
      savedData: makeSavedData({ id: "abc", durationMs: 2300 }),
    });
    expect(phase.kind).toBe("saved");
    if (phase.kind === "saved") {
      expect(phase.saved.reviewId).toBe("abc");
      expect(phase.saved.durationMs).toBe(2300);
    }
  });

  test("durationMs=null in metadata becomes undefined in saved", () => {
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: false,
      savedData: makeSavedData({ id: "abc", durationMs: null }),
    });
    if (phase.kind === "saved") {
      expect(phase.saved.durationMs).toBe(undefined);
    } else {
      expect.fail("expected saved phase");
    }
  });

  test("reviewId without data and not loading → fallback streaming", () => {
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: false,
      savedData: undefined,
    });
    expect(phase.kind).toBe("streaming");
  });

  test("loading-saved takes precedence over a stale savedData payload", () => {
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: true,
      savedData: makeSavedData({ id: "abc", durationMs: 1000 }),
    });
    expect(phase.kind).toBe("loading-saved");
  });

  test("saved phase passes issues array through unchanged", () => {
    const issues = [
      {
        id: "i-1",
        severity: "high" as const,
        category: "security" as const,
        title: "t",
        file: "f.ts",
        line_start: 1,
        line_end: 1,
        rationale: "r",
        recommendation: "rec",
        suggested_patch: null,
        confidence: 0.9,
        symptom: "s",
        whyItMatters: "w",
        evidence: [],
      },
    ];
    const phase = selectReviewScreenPhase({
      reviewId: "abc",
      savedIsLoading: false,
      savedData: makeSavedData({ id: "abc", durationMs: 1000, issues }),
    });
    if (phase.kind !== "saved") {
      expect.fail("expected saved phase");
    }
    expect(phase.saved.issues.length).toBe(1);
    expect(phase.saved.issues[0]?.id).toBe("i-1");
  });
});
