import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { describe, expect, it, vi } from "vitest";

// The bundled catalog is generated output: pinning a real model's context window
// here would break on every regeneration, so the windows this gate reasons about
// are fixtures with the three shapes that matter — a small window with its own
// output ceiling, a huge window, and a model the catalog states no window for.
vi.mock("@diffgazer/core/catalog", () => ({
  PROVIDER_OVERLAY: { gemini: { modelsDevIds: ["google"] } },
  CATALOG_SNAPSHOT: {
    google: {
      id: "google",
      name: "Google",
      models: {
        "small-window": {
          id: "small-window",
          name: "Small Window",
          limit: { context: 128_000, output: 8_000 },
        },
        "huge-window": {
          id: "huge-window",
          name: "Huge Window",
          limit: { context: 2_000_000, output: 64_000 },
        },
        "unknown-window": { id: "unknown-window", name: "Unknown Window" },
      },
    },
  },
}));

const { clientTestAdmittedPlan } = await import("../../shared/lib/testing/ai-client-fixtures.js");
const { makeParsedDiff } = await import("./testing/factories.js");
const { estimateReviewPromptTokens, evaluateReviewCapacity, LARGE_DIFF_ADVISORY_BYTES } =
  await import("./capacity.js");

function diffOfSize(totalBytes: number, fileCount = 1) {
  const perFile = Math.floor(totalBytes / fileCount);
  return makeParsedDiff(
    Array.from({ length: fileCount }, (_, index) => ({
      filePath: `src/file-${index}.ts`,
      stats: {
        additions: 1,
        deletions: 0,
        sizeBytes: index === 0 ? totalBytes - perFile * (fileCount - 1) : perFile,
      },
    })),
  );
}

function planFor(modelId: string) {
  return clientTestAdmittedPlan("gemini", { modelId });
}

describe("estimateReviewPromptTokens", () => {
  it("is never cheaper than the byte rate the dispatch gate prices a prompt at", () => {
    const parsed = diffOfSize(400 * 1024, 4);
    expect(estimateReviewPromptTokens(parsed)).toBeGreaterThan(
      parsed.totalStats.totalSizeBytes / 4,
    );
  });

  it("grows with the diff and with the files it spans", () => {
    const small = estimateReviewPromptTokens(diffOfSize(10_000, 1));
    const larger = estimateReviewPromptTokens(diffOfSize(20_000, 1));
    const spread = estimateReviewPromptTokens(diffOfSize(20_000, 20));

    expect(larger).toBeGreaterThan(small);
    expect(spread).toBeGreaterThan(larger);
  });
});

describe("evaluateReviewCapacity", () => {
  it("admits a small diff without a warning", () => {
    const result = evaluateReviewCapacity({
      parsed: diffOfSize(20 * 1024),
      plan: planFor("small-window"),
    });

    expect(result).toEqual({ ok: true, value: null });
  });

  it("fails a diff past the model's context window and states the numbers", () => {
    const parsed = diffOfSize(2 * 1024 * 1024, 12);
    const result = evaluateReviewCapacity({ parsed, plan: planFor("small-window") });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ReviewErrorCode.DIFF_TOO_LARGE);
    expect(result.error.step).toBe("diff");
    expect(result.error.message).toContain("small-window");
    expect(result.error.message).toContain("128,000-token context window");
    expect(result.error.message).toContain("8,000 reserved for the answer");
    expect(result.error.message).toContain("2.00MB across 12 files");
    expect(result.error.message).toContain(
      estimateReviewPromptTokens(parsed).toLocaleString("en-US"),
    );
    // No auto-truncation: the gate refuses, it does not quietly shrink the diff.
    expect(parsed.files).toHaveLength(12);
  });

  it("admits an over-advisory diff the window still holds, with a warning carrying the numbers", () => {
    const parsed = diffOfSize(LARGE_DIFF_ADVISORY_BYTES + 1, 3);
    const result = evaluateReviewCapacity({ parsed, plan: planFor("huge-window") });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected a size warning");
    expect(result.value).toMatchObject({
      diffBytes: LARGE_DIFF_ADVISORY_BYTES + 1,
      estimatedInputTokens: estimateReviewPromptTokens(parsed),
      contextTokens: 2_000_000,
      modelId: "huge-window",
    });
    expect(result.value.message).toContain("huge-window");
    expect(result.value.message).toContain("2,000,000-token context window");
  });

  it("does not warn at exactly the advisory threshold", () => {
    const result = evaluateReviewCapacity({
      parsed: diffOfSize(LARGE_DIFF_ADVISORY_BYTES),
      plan: planFor("huge-window"),
    });

    expect(result).toEqual({ ok: true, value: null });
  });

  it("never hard-fails a model the catalog states no window for", () => {
    const parsed = diffOfSize(4 * 1024 * 1024, 2);
    const result = evaluateReviewCapacity({ parsed, plan: planFor("unknown-window") });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected a size warning");
    expect(result.value.contextTokens).toBeNull();
    expect(result.value.modelId).toBe("unknown-window");
    expect(result.value.message).toContain("within the configured limits");
  });

  it("never hard-fails when no admitted plan names a model", () => {
    const parsed = diffOfSize(4 * 1024 * 1024, 2);
    const result = evaluateReviewCapacity({ parsed, plan: undefined });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) throw new Error("expected a size warning");
    expect(result.value.modelId).toBeNull();
    expect(result.value.contextTokens).toBeNull();
  });
});
