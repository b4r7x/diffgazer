import { ReviewErrorCode, ReviewSizeWarningSchema } from "@diffgazer/core/schemas/review";
import { describe, expect, it, vi } from "vitest";

// The bundled catalog is generated output: pinning a real model's context window
// here would break on every regeneration, so the windows this gate reasons about
// are fixtures with the three shapes that matter — a small window with its own
// output ceiling, a huge window, and a model the catalog states no window for.
vi.mock("@diffgazer/core/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/catalog")>()),
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
const { estimateReviewPromptTokens } = await import("./engine/diff/estimate.js");
const { evaluateReviewCapacity, LARGE_DIFF_ADVISORY_BYTES } = await import("./capacity.js");

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

/** Mirrors `EFFECTIVE_CALL_TOKEN_CAP.default`; the wide cap only lets the window bind. */
const DEFAULT_CALL_TOKEN_CAP = 49_152;
const WIDE_CALL_TOKEN_CAP = 1_048_576;

function evaluate(params: {
  parsed: ReturnType<typeof diffOfSize>;
  modelId?: string;
  effectiveCallTokenCap?: number;
  lensCount?: number;
}) {
  return evaluateReviewCapacity({
    parsed: params.parsed,
    plan: params.modelId === undefined ? undefined : planFor(params.modelId),
    effectiveCallTokenCap: params.effectiveCallTokenCap ?? DEFAULT_CALL_TOKEN_CAP,
    lensCount: params.lensCount ?? 1,
  });
}

function planOf(result: ReturnType<typeof evaluate>) {
  if (!result.ok) throw new Error(`expected a capacity plan, got ${result.error.message}`);
  return result.value;
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
  it("admits a small diff as one batch, without a warning", () => {
    const parsed = diffOfSize(20 * 1024);
    const plan = planOf(evaluate({ parsed, modelId: "small-window" }));

    expect(plan.batches).toEqual([parsed]);
    expect(plan.warning).toBeNull();
  });

  it("budgets a call at the smaller of the window and the configured cap", () => {
    const parsed = diffOfSize(20 * 1024);

    expect(planOf(evaluate({ parsed, modelId: "huge-window" })).perCallBudgetTokens).toBe(
      DEFAULT_CALL_TOKEN_CAP,
    );
    // 128,000-token window less the 8,000 it reserves for the answer.
    expect(
      planOf(
        evaluate({ parsed, modelId: "small-window", effectiveCallTokenCap: WIDE_CALL_TOKEN_CAP }),
      ).perCallBudgetTokens,
    ).toBe(120_000);
  });

  it("batches a diff past the per-call budget instead of failing it", () => {
    const parsed = diffOfSize(2 * 1024 * 1024, 12);
    const plan = planOf(evaluate({ parsed, modelId: "small-window" }));

    expect(plan.batches.length).toBeGreaterThan(1);
    expect(plan.batches.flatMap((batch) => batch.files)).toHaveLength(12);
    for (const batch of plan.batches) {
      expect(estimateReviewPromptTokens(batch)).toBeLessThanOrEqual(120_000);
    }
  });

  it("fails a single file that does not fit the window even alone, and names it", () => {
    const parsed = diffOfSize(500 * 1024, 1);
    const result = evaluate({ parsed, modelId: "small-window" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ReviewErrorCode.DIFF_TOO_LARGE);
    expect(result.error.step).toBe("diff");
    expect(result.error.message).toContain("src/file-0.ts");
    expect(result.error.message).toContain("small-window");
    expect(result.error.message).toContain("128,000-token context window");
    expect(result.error.message).toContain("8,000 reserved for the answer");
    expect(result.error.message).toContain(
      estimateReviewPromptTokens(parsed).toLocaleString("en-US"),
    );
    // No auto-truncation: the gate refuses, it does not quietly shrink the diff.
    expect(parsed.files).toHaveLength(1);
  });

  it("discloses a multi-batch plan with its batch count and cumulative cost", () => {
    // Three 100KB files: each one fits the default cap, no two of them do.
    const parsed = diffOfSize(300 * 1024, 3);
    const plan = planOf(evaluate({ parsed, modelId: "small-window", lensCount: 5 }));

    expect(plan.batches).toHaveLength(3);
    expect(plan.warning).toMatchObject({
      batchCount: 3,
      estimatedTotalInputTokens: plan.estimatedTotalInputTokens,
      diffBytes: 300 * 1024,
      modelId: "small-window",
    });
    // Each batch is priced with the roster of files it does not carry, because
    // that is what its prompt names.
    expect(plan.estimatedTotalInputTokens).toBe(
      5 *
        plan.batches.reduce(
          (total, batch) =>
            total + estimateReviewPromptTokens(batch, parsed.files.length - batch.files.length),
          0,
        ),
    );
    expect(plan.warning?.message).toContain("3 sequential batches");
    expect(plan.warning?.message).toContain("synthesis pass");
    expect(plan.warning?.message).toContain(plan.estimatedTotalInputTokens.toLocaleString("en-US"));
    // The disclosure travels on the wire, so it has to survive its own schema.
    expect(ReviewSizeWarningSchema.parse(plan.warning)).toEqual(plan.warning);
  });

  it("admits an over-advisory diff the budget still holds, with a warning carrying the numbers", () => {
    const parsed = diffOfSize(LARGE_DIFF_ADVISORY_BYTES + 1, 3);
    const plan = planOf(
      evaluate({ parsed, modelId: "huge-window", effectiveCallTokenCap: WIDE_CALL_TOKEN_CAP }),
    );

    expect(plan.batches).toHaveLength(1);
    expect(plan.warning).toMatchObject({
      diffBytes: LARGE_DIFF_ADVISORY_BYTES + 1,
      estimatedInputTokens: estimateReviewPromptTokens(parsed),
      contextTokens: 2_000_000,
      modelId: "huge-window",
    });
    expect(plan.warning?.batchCount).toBeUndefined();
    expect(plan.warning?.estimatedTotalInputTokens).toBeUndefined();
    expect(plan.warning?.message).toContain("huge-window");
    expect(plan.warning?.message).toContain("2,000,000-token context window");
  });

  it("does not warn at exactly the advisory threshold", () => {
    const plan = planOf(
      evaluate({
        parsed: diffOfSize(LARGE_DIFF_ADVISORY_BYTES),
        modelId: "huge-window",
        effectiveCallTokenCap: WIDE_CALL_TOKEN_CAP,
      }),
    );

    expect(plan.batches).toHaveLength(1);
    expect(plan.warning).toBeNull();
  });

  it("never hard-fails a model the catalog states no window for", () => {
    const parsed = diffOfSize(600 * 1024, 2);
    const plan = planOf(
      evaluate({ parsed, modelId: "unknown-window", effectiveCallTokenCap: WIDE_CALL_TOKEN_CAP }),
    );

    expect(plan.batches).toHaveLength(1);
    expect(plan.warning?.contextTokens).toBeNull();
    expect(plan.warning?.modelId).toBe("unknown-window");
    expect(plan.warning?.message).toContain("within the configured limits");
  });

  it("never hard-fails when no admitted plan names a model", () => {
    const parsed = diffOfSize(600 * 1024, 2);
    const plan = planOf(evaluate({ parsed, effectiveCallTokenCap: WIDE_CALL_TOKEN_CAP }));

    expect(plan.warning?.modelId).toBeNull();
    expect(plan.warning?.contextTokens).toBeNull();
  });
});
