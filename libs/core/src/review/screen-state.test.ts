import { describe, expect, it } from "vitest";
import type { ExecutionReceipt } from "../schemas/review/index.js";
import {
  resolveSavedReviewOutcome,
  type SavedReviewQueryState,
  toSavedReviewQueryState,
} from "./screen-state.js";

function terminalReceipt(
  outcome: Exclude<ExecutionReceipt["outcome"], "completed">,
  usageAvailability: ExecutionReceipt["usageAvailability"] = "unavailable",
): ExecutionReceipt {
  return { outcome, usageAvailability } as ExecutionReceipt;
}

function issue(id: string) {
  return {
    id,
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
  };
}

describe("resolveSavedReviewOutcome", () => {
  it("returns results when a stored result exists", () => {
    const state: SavedReviewQueryState = {
      status: "success",
      review: {
        metadata: { id: "abc", durationMs: 1200 },
        result: { issues: [issue("i-1")] },
        droppedDuplicates: 1,
      },
    };
    const outcome = resolveSavedReviewOutcome(state, false);
    expect(outcome.kind).toBe("results");
    if (outcome.kind === "results") {
      expect(outcome.data.reviewId).toBe("abc");
      expect(outcome.data.durationMs).toBe(1200);
      expect(outcome.data.issues).toHaveLength(1);
      expect(outcome.data.droppedDuplicates).toBe(1);
    }
  });

  it("falls back to streaming when a saved review has no result and the stream has not 404'd", () => {
    const state: SavedReviewQueryState = {
      status: "success",
      review: { metadata: { id: "abc" }, result: null },
    };
    expect(resolveSavedReviewOutcome(state, false).kind).toBe("fallback-to-stream");
  });

  it("reports not-found when a result-less saved review meets an already-404'd stream", () => {
    const state: SavedReviewQueryState = {
      status: "success",
      review: { metadata: { id: "abc" }, result: null },
    };
    expect(resolveSavedReviewOutcome(state, true).kind).toBe("not-found");
  });

  it("falls back to streaming on a 404 read when the stream has not 404'd", () => {
    const state: SavedReviewQueryState = {
      status: "error",
      error: Object.assign(new Error("not found"), { status: 404 }),
      notFound: true,
    };
    expect(resolveSavedReviewOutcome(state, false).kind).toBe("fallback-to-stream");
  });

  it("reports not-found on a 404 read once the stream has also 404'd", () => {
    const state: SavedReviewQueryState = {
      status: "error",
      error: Object.assign(new Error("not found"), { status: 404 }),
      notFound: true,
    };
    expect(resolveSavedReviewOutcome(state, true).kind).toBe("not-found");
  });

  it("reports the error for a non-404 read failure", () => {
    const error = new Error("legacy review rejected");
    const state: SavedReviewQueryState = {
      status: "error",
      error,
      notFound: false,
    };
    const outcome = resolveSavedReviewOutcome(state, false);
    expect(outcome.kind).toBe("report-error");
    if (outcome.kind === "report-error") {
      expect(outcome.error).toBe(error);
    }
  });

  it("returns loading while the query is pending", () => {
    const state: SavedReviewQueryState = {
      status: "pending",
    };
    expect(resolveSavedReviewOutcome(state, false).kind).toBe("loading");
  });

  it("returns terminal before a truthy empty result for non-completed executions", () => {
    const state: SavedReviewQueryState = {
      status: "success",
      review: {
        metadata: { id: "abc", durationMs: 900 },
        result: { issues: [] },
        execution: {
          receipt: terminalReceipt("cancelled"),
        },
      },
    };

    const outcome = resolveSavedReviewOutcome(state, false);
    expect(outcome.kind).toBe("terminal");
    if (outcome.kind === "terminal") {
      expect(outcome.data.reviewId).toBe("abc");
      expect(outcome.data.outcome).toBe("cancelled");
      expect(outcome.data.usageAvailability).toBe("unavailable");
    }
  });

  it("prefers executionSnapshot over raw execution for terminal resolution", () => {
    const state: SavedReviewQueryState = {
      status: "success",
      review: {
        metadata: { id: "abc" },
        result: { issues: [] },
        execution: {
          receipt: {
            outcome: "completed",
            usageAvailability: "reported",
          } as unknown as ExecutionReceipt,
        },
        executionSnapshot: {
          receipt: terminalReceipt("transport-failed", "reported"),
        },
      },
    };

    const outcome = resolveSavedReviewOutcome(state, false);
    expect(outcome.kind).toBe("terminal");
    if (outcome.kind === "terminal") {
      expect(outcome.data.outcome).toBe("transport-failed");
    }
  });
});

describe("saved review query presentation", () => {
  it("maps query status and recognizes API 404 errors", () => {
    const error = Object.assign(new Error("missing"), { status: 404 });

    expect(toSavedReviewQueryState({ status: "error", error })).toEqual({
      status: "error",
      error,
      notFound: true,
    });
    expect(toSavedReviewQueryState({ status: "pending" })).toEqual({ status: "pending" });
    expect(toSavedReviewQueryState({ status: "success", data: undefined })).toEqual({
      status: "success",
      review: null,
    });
  });
});
