import { describe, expect, it } from "vitest";
import { makeReadiness } from "../../testing/provider-fixtures.js";
import { canStartReview, deriveReviewGate } from "./use-review-lifecycle-base.js";

describe("deriveReviewGate", () => {
  it("gates on loading when a loadingMessage is present, even if other flags are set", () => {
    expect(
      deriveReviewGate({
        loadingMessage: "Checking for changes...",
        canStart: false,
        isNoDiffError: true,
      }),
    ).toBe("loading");
  });

  it("gates on unconfigured when not loading and the review cannot start", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        canStart: false,
        isNoDiffError: true,
      }),
    ).toBe("unconfigured");
  });

  it("gates on no-diff when loaded and startable but there is no diff to review", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        canStart: true,
        isNoDiffError: true,
      }),
    ).toBe("no-diff");
  });

  it("falls through to running once loaded, startable, and a diff exists", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        canStart: true,
        isNoDiffError: false,
      }),
    ).toBe("running");
  });
});

describe("review start readiness gate", () => {
  it("only allows review start when readiness is ready", () => {
    expect(canStartReview({ readiness: makeReadiness("ready") })).toBe(true);
    expect(canStartReview({ readiness: makeReadiness("credential-invalid") })).toBe(false);
    expect(canStartReview({ readiness: makeReadiness("model-missing") })).toBe(false);
    expect(canStartReview({ readiness: makeReadiness("acknowledgement-required") })).toBe(false);
  });

  it("allows review start when only structured-output conformance is unproven", () => {
    for (const status of ["conformance-pending", "skipped", "conformance-failed"] as const) {
      expect(canStartReview({ readiness: makeReadiness(status) })).toBe(true);
      expect(
        deriveReviewGate({
          loadingMessage: null,
          canStart: canStartReview({ readiness: makeReadiness(status) }),
          isNoDiffError: false,
        }),
      ).toBe("running");
    }
    expect(
      deriveReviewGate({
        loadingMessage: null,
        canStart: canStartReview({ readiness: makeReadiness("credential-invalid") }),
        isNoDiffError: false,
      }),
    ).toBe("unconfigured");
  });

  it("blocks review start when no configuration is selected", () => {
    expect(canStartReview({ readiness: null })).toBe(false);
  });

  it("allows completed saved review resume without readiness or secret access", () => {
    expect(
      canStartReview({
        readiness: makeReadiness("local-conformance-failed"),
        allowResumeWithoutSetup: true,
      }),
    ).toBe(true);
    expect(canStartReview({ readiness: null, allowResumeWithoutSetup: true })).toBe(true);
  });
});
