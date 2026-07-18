import { describe, expect, it } from "vitest";
import { deriveReviewGate } from "./use-review-lifecycle-base.js";

describe("deriveReviewGate", () => {
  it("gates on loading when a loadingMessage is present, even if other flags are set", () => {
    expect(
      deriveReviewGate({
        loadingMessage: "Checking for changes...",
        isConfigured: false,
        isNoDiffError: true,
      }),
    ).toBe("loading");
  });

  it("gates on unconfigured when not loading and the provider is not configured", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: false,
        isNoDiffError: true,
      }),
    ).toBe("unconfigured");
  });

  it("gates on no-diff when loaded and configured but there is no diff to review", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: true,
        isNoDiffError: true,
      }),
    ).toBe("no-diff");
  });

  it("falls through to running once loaded, configured, and a diff exists", () => {
    expect(
      deriveReviewGate({
        loadingMessage: null,
        isConfigured: true,
        isNoDiffError: false,
      }),
    ).toBe("running");
  });
});
