import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { log } from "../../../shared/lib/log.js";
import { reviewAbort } from "../abort.js";
import {
  isAbortError,
  isReviewStreamErrorCode,
  isTerminalEvent,
  normalizeReviewStreamError,
  reviewStreamError,
} from "./events.js";

vi.mock("../../../shared/lib/log.js", () => ({ log: vi.fn() }));

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

  it("surfaces GIT_NOT_FOUND as itself instead of collapsing to GENERATION_FAILED", () => {
    const abort = reviewAbort("git missing", ReviewErrorCode.GIT_NOT_FOUND, "diff");
    expect(normalizeReviewStreamError(abort).code).toBe(ReviewErrorCode.GIT_NOT_FOUND);
    expect(reviewStreamError(abort.message, abort.code)).toEqual({
      type: "error",
      error: { code: ReviewErrorCode.GIT_NOT_FOUND, message: "git missing" },
    });
  });

  it("falls back to the default code when untrusted input carries an out-of-union code", () => {
    // reviewAbort cannot produce an out-of-union code anymore (it is typed), so
    // this models a raw/untrusted error object reaching normalizeReviewStreamError.
    const untrusted = { kind: "review_abort", message: "custom message", code: "WEIRD_CODE" };
    expect(normalizeReviewStreamError(untrusted)).toEqual({
      code: ReviewErrorCode.GENERATION_FAILED,
      message: "custom message",
    });
  });

  it("keeps a valid code when the step is invalid", () => {
    const malformed = {
      kind: "review_abort",
      message: "unknown step",
      code: ReviewErrorCode.AI_ERROR,
      step: "not-a-step",
    };
    expect(normalizeReviewStreamError(malformed)).toEqual({
      code: ReviewErrorCode.AI_ERROR,
      message: "unknown step",
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

describe("stream error redaction", () => {
  it.each([
    { name: "a bearer token", raw: "upstream rejected Bearer sk-live-abcdefgh1234" },
    { name: "an API-key literal", raw: "auth failed for sk-proj-abcdefgh12345678" },
    { name: "a home path", raw: "ENOENT: /Users/someone/.diffgazer/config.json" },
    { name: "a correlation id", raw: "dispatch failed correlationId=8f2c1a" },
  ])("replaces $name before it reaches the stream", ({ raw }) => {
    const normalized = normalizeReviewStreamError(new Error(raw));

    expect(normalized.message).not.toContain("Bearer");
    expect(normalized.message).not.toContain("sk-");
    expect(normalized.message).not.toContain("/Users/");
    expect(normalized.message).not.toContain("correlationId");
    expect(normalized.message).toContain("could not present this failure safely");
  });

  it("keeps an ordinary diagnostic message intact", () => {
    expect(normalizeReviewStreamError(new Error("model returned no candidates")).message).toBe(
      "model returned no candidates",
    );
  });

  it("redacts an abort message carrying a raw diagnostic", () => {
    const abort = reviewAbort(
      "context build failed at /Users/someone/repo",
      ReviewErrorCode.GENERATION_FAILED,
      "context",
    );

    expect(normalizeReviewStreamError(abort).message).not.toContain("/Users/");
  });
});

describe("internal-error boundary", () => {
  const HONEST_COPY_START = "Diffgazer hit an internal error while processing this review.";

  beforeEach(() => {
    vi.mocked(log).mockClear();
  });

  function makeZodError(): z.ZodError {
    const parsed = z.strictObject({ usage: z.number() }).safeParse({ usage: "many" });
    if (parsed.success) throw new Error("expected a zod failure");
    return parsed.error;
  }

  it("turns a real ZodError into honest copy with the first issue, never raw JSON", () => {
    const normalized = normalizeReviewStreamError(makeZodError(), undefined, { reviewId: "rid" });

    expect(normalized.code).toBe(ReviewErrorCode.INTERNAL_ERROR);
    expect(normalized.message.startsWith(HONEST_COPY_START)).toBe(true);
    expect(normalized.message).toContain("Internal check failed:");
    expect(normalized.message.startsWith("[")).toBe(false);
    expect(normalized.message.startsWith("{")).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "error",
      "review_error_scrubbed",
      expect.objectContaining({
        reason: "zod",
        code: ReviewErrorCode.INTERNAL_ERROR,
        reviewId: "rid",
      }),
    );
  });

  it("caps the first-issue sentence at 200 chars", () => {
    const oversized = "x".repeat(500);
    const parsed = z
      .string()
      .refine(() => false, oversized)
      .safeParse("value");
    if (parsed.success) throw new Error("expected a zod failure");

    const normalized = normalizeReviewStreamError(parsed.error);
    const detail = normalized.message.split("Internal check failed: ")[1];

    expect(detail).toHaveLength(200);
  });

  it.each([
    ReviewErrorCode.CANCELLED,
    ReviewErrorCode.INTERNAL_ERROR,
  ])("replaces a serialized JSON message inside a typed abort and keeps code %s", (code) => {
    const abort = reviewAbort('[{"code":"too_big","message":"Too big"}]', code, "diff");
    const normalized = normalizeReviewStreamError(abort);

    expect(normalized.code).toBe(code);
    expect(normalized.message.startsWith(HONEST_COPY_START)).toBe(true);
    expect(normalized.message).not.toContain("Internal check failed");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "error",
      "review_error_scrubbed",
      expect.objectContaining({ reason: "serialized-message", code }),
    );
  });

  it("replaces a serialized JSON message on an untyped error and resolves INTERNAL_ERROR", () => {
    const normalized = normalizeReviewStreamError(new Error('{"issues":[]}'));

    expect(normalized.code).toBe(ReviewErrorCode.INTERNAL_ERROR);
    expect(normalized.message.startsWith(HONEST_COPY_START)).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("keeps a provider code while replacing its serialized JSON message", () => {
    const normalized = normalizeReviewStreamError({
      code: ReviewErrorCode.PROVIDER_REJECTED,
      message: '{"error":{"message":"quota exceeded"}}',
    });

    expect(normalized.code).toBe(ReviewErrorCode.PROVIDER_REJECTED);
    expect(normalized.message.startsWith(HONEST_COPY_START)).toBe(true);
    expect(log).toHaveBeenCalledWith(
      "error",
      "review_error_scrubbed",
      expect.objectContaining({
        reason: "serialized-message",
        code: ReviewErrorCode.PROVIDER_REJECTED,
      }),
    );
  });

  it("passes the provider-400 prose through verbatim without logging", () => {
    const prose =
      "Z.AI rejected the request as invalid (HTTP 400). Often the diff is too large for the model's context window. Reduce the review scope, or choose a model with a larger context.";

    expect(normalizeReviewStreamError(new Error(prose)).message).toBe(prose);
    expect(log).not.toHaveBeenCalled();
  });

  it("passes a plain provider error through verbatim without logging", () => {
    expect(normalizeReviewStreamError(new Error("provider said no")).message).toBe(
      "provider said no",
    );
    expect(log).not.toHaveBeenCalled();
  });
});

// Type-level guard (enforced by `pnpm --filter @diffgazer/server type-check`): the code
// param is the typed review-error union, so an out-of-union code is a compile error
// instead of a runtime GENERATION_FAILED collapse.
void (() =>
  // @ts-expect-error out-of-union code must not compile
  reviewStreamError("msg", "nope"));

describe("reviewStreamError", () => {
  it("returns a typed error event with the provided code", () => {
    expect(reviewStreamError("msg", ReviewErrorCode.SESSION_STALE)).toEqual({
      type: "error",
      error: { code: ReviewErrorCode.SESSION_STALE, message: "msg" },
    });
  });
});

describe("isTerminalEvent", () => {
  it("recognizes complete and error events", () => {
    expect(
      isTerminalEvent({
        type: "complete",
        result: { issues: [] },
        reviewId: "rid",
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
