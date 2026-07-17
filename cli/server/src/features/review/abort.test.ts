import { processReviewStream } from "@diffgazer/core/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { isReviewAbort, reviewAbort } from "./abort.js";
import { normalizeReviewStreamError, reviewStreamError } from "./stream/events.js";

function createSSEReader(event: unknown): ReadableStreamDefaultReader<Uint8Array> {
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).getReader();
}

describe("reviewAbort", () => {
  it("creates review abort objects with an optional step", () => {
    expect(reviewAbort("something failed", ReviewErrorCode.GIT_NOT_FOUND, "diff")).toEqual({
      kind: "review_abort",
      message: "something failed",
      code: "GIT_NOT_FOUND",
      step: "diff",
    });
    expect(reviewAbort("msg", ReviewErrorCode.AI_ERROR).step).toBeUndefined();
  });

  it("rejects a code outside the review-error union at compile time", () => {
    // @ts-expect-error — only ReviewErrorCode members are accepted, so a code
    // that would silently collapse to GENERATION_FAILED on the wire is a compile error.
    reviewAbort("msg", "NOT_A_REVIEW_CODE");
  });
});

describe("isReviewAbort", () => {
  it.each([
    { value: reviewAbort("msg", ReviewErrorCode.AI_ERROR, "diff"), expected: true },
    { value: reviewAbort("msg", ReviewErrorCode.AI_ERROR), expected: true },
    { value: null, expected: false },
    { value: undefined, expected: false },
    { value: new Error("oops"), expected: false },
    { value: { kind: "other", message: "msg", code: "CODE" }, expected: false },
    { value: { kind: "review_abort", code: "CODE" }, expected: false },
    {
      value: { kind: "review_abort", message: "bad code", code: "NOT_A_REVIEW_CODE" },
      expected: false,
    },
    {
      value: {
        kind: "review_abort",
        message: "bad step",
        code: ReviewErrorCode.AI_ERROR,
        step: "not-a-step",
      },
      expected: false,
    },
  ])("returns $expected for $value", ({ value, expected }) => {
    expect(isReviewAbort(value)).toBe(expected);
  });

  it.each([
    {
      malformed: {
        kind: "review_abort",
        message: "unknown error code",
        code: "NOT_A_REVIEW_CODE",
        step: "diff",
      },
      expectedCode: ReviewErrorCode.GENERATION_FAILED,
    },
    {
      malformed: {
        kind: "review_abort",
        message: "unknown step",
        code: ReviewErrorCode.AI_ERROR,
        step: "not-a-step",
      },
      expectedCode: ReviewErrorCode.AI_ERROR,
    },
  ])("normalizes a malformed abort to client-readable $expectedCode through the shared stream", async ({
    malformed,
    expectedCode,
  }) => {
    expect(isReviewAbort(malformed)).toBe(false);
    const normalized = normalizeReviewStreamError(malformed);
    const result = await processReviewStream(
      createSSEReader(reviewStreamError(normalized.message, normalized.code)),
      {},
    );

    expect(result).toEqual({
      ok: false,
      error: { code: expectedCode, message: malformed.message },
    });
  });
});
