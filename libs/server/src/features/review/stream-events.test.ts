import { describe, expect, it } from "vitest";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { reviewAbort } from "./abort.js";
import {
  isAbortError,
  isReviewStreamErrorCode,
  isTerminalEvent,
  normalizeReviewStreamError,
  reviewStreamError,
} from "./stream-events.js";

describe("isReviewStreamErrorCode", () => {
  it("returns true for known review error codes", () => {
    expect(isReviewStreamErrorCode(ReviewErrorCode.GENERATION_FAILED)).toBe(true);
    expect(isReviewStreamErrorCode(ReviewErrorCode.SESSION_STALE)).toBe(true);
  });

  it("returns false for unknown codes", () => {
    expect(isReviewStreamErrorCode("UNKNOWN_CODE")).toBe(false);
  });
});

describe("normalizeReviewStreamError", () => {
  it("preserves code and message from review abort errors", () => {
    const abort = reviewAbort("aborted", ReviewErrorCode.SESSION_STALE, "diff");
    expect(normalizeReviewStreamError(abort)).toEqual({
      code: ReviewErrorCode.SESSION_STALE,
      message: "aborted",
    });
  });

  it("falls back to the default code when an abort error uses an unknown code", () => {
    const abort = reviewAbort("custom message", "WEIRD_CODE", "diff");
    expect(normalizeReviewStreamError(abort)).toEqual({
      code: ReviewErrorCode.GENERATION_FAILED,
      message: "custom message",
    });
  });

  it("uses the provided fallback when the error has no usable code", () => {
    expect(normalizeReviewStreamError({ message: "boom" }, ReviewErrorCode.SESSION_STALE)).toEqual({
      code: ReviewErrorCode.SESSION_STALE,
      message: "boom",
    });
  });

  it("extracts message from a plain Error", () => {
    expect(normalizeReviewStreamError(new Error("network"))).toMatchObject({
      code: ReviewErrorCode.GENERATION_FAILED,
      message: "network",
    });
  });

  it("uses a fallback message when none is present", () => {
    expect(normalizeReviewStreamError(null)).toMatchObject({
      code: ReviewErrorCode.GENERATION_FAILED,
    });
  });
});

describe("reviewStreamError", () => {
  it("returns a typed error event with the provided code", () => {
    expect(reviewStreamError("msg", ReviewErrorCode.SESSION_STALE)).toEqual({
      type: "error",
      error: { code: ReviewErrorCode.SESSION_STALE, message: "msg" },
    });
  });

  it("falls back to GENERATION_FAILED for an unknown code", () => {
    expect(reviewStreamError("msg", "nope")).toEqual({
      type: "error",
      error: { code: ReviewErrorCode.GENERATION_FAILED, message: "msg" },
    });
  });
});

describe("isTerminalEvent", () => {
  it("recognizes complete and error events", () => {
    expect(
      isTerminalEvent({
        type: "complete",
        result: { issues: [], summary: "" },
        reviewId: "rid",
        durationMs: 0,
      }),
    ).toBe(true);
    expect(
      isTerminalEvent({
        type: "error",
        error: { code: ReviewErrorCode.GENERATION_FAILED, message: "" },
      }),
    ).toBe(true);
  });

  it("returns false for non-terminal events", () => {
    expect(
      isTerminalEvent({
        type: "step_start",
        step: "diff",
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});

describe("isAbortError", () => {
  it("returns true only for DOMException AbortError", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("aborted"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
