import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it, vi } from "vitest";
import { executeHostedReview } from "./execute.js";
import {
  executeRequest,
  hostedContext,
  mockFetchResponse,
  openAiSuccessBody,
} from "./execute.test-support.js";

// The provider issue contract trims a blank required text instead of rejecting
// it, so the completeness gate can drop that one finding and account for it. The
// adapter's completed-result bound must accept the same answer, or the whole lens
// dies on the very finding the gate exists to drop.
const whole = makeIssue({ id: "whole" });
const blank = makeIssue({ id: "blank", symptom: "   " });

describe("a blank required text on one finding", () => {
  it("completes with the whole answer for the completeness gate to trim, without spending a correction round", async () => {
    const fetch = mockFetchResponse(openAiSuccessBody({ issues: [whole, blank] }));
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues.map((issue) => issue.id)).toEqual(["whole", "blank"]);
    expect(result.result.issues[1]).toMatchObject({ symptom: "" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it("still completes when the finding is salvaged after the correction round", async () => {
    const fetch = mockFetchResponse(
      openAiSuccessBody({ issues: [{ ...whole, severity: "urgent" }, blank] }),
    );
    const reportDiagnostic = vi.fn();

    const result = await executeHostedReview({
      ...executeRequest("zai"),
      context: hostedContext(fetch),
      reportDiagnostic,
    });

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues.map((issue) => issue.id)).toEqual(["blank"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "output-salvaged",
        salvage: { keptFindingCount: 1, droppedCandidateCount: 1 },
      }),
    );
  });
});
