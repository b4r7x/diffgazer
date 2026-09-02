import { describe, expect, it } from "vitest";
import { HOSTED_PROFILES, resolveDispatchPacing } from "./profiles.js";

describe("resolveDispatchPacing", () => {
  it("clamps the documented free flash models to one concurrent request", () => {
    expect(resolveDispatchPacing("zai", "glm-4.5-flash")).toEqual({
      perDispatchWallTimeMs: 300_000,
      maxParallelDispatches: 1,
    });
    expect(resolveDispatchPacing("zai", "glm-4.7-flash")).toEqual({
      perDispatchWallTimeMs: 300_000,
      maxParallelDispatches: 1,
    });
  });

  it("does not clamp paid zai models and merges the glm-5 reasoning override", () => {
    expect(resolveDispatchPacing("zai", "glm-5.2")).toEqual({
      perDispatchWallTimeMs: 300_000,
      reasoning: "may-reason",
    });
    expect(resolveDispatchPacing("zai", "glm-4.6")).toEqual({
      perDispatchWallTimeMs: 300_000,
    });
  });

  it("sizes the openrouter per-dispatch wall for free-pool queueing and reasoning routes", () => {
    expect(resolveDispatchPacing("openrouter", "nvidia/nemotron-3-super-120b-a12b:free")).toEqual({
      perDispatchWallTimeMs: 600_000,
      bodyIdleTimeoutMs: 360_000,
    });
    expect(resolveDispatchPacing("openrouter", "openai/gpt-5.2")).toEqual({
      perDispatchWallTimeMs: 600_000,
      bodyIdleTimeoutMs: 360_000,
    });
  });

  it("gives opencode-zen an answer-idle budget inside its 300s wall", () => {
    expect(resolveDispatchPacing("opencode-zen", "deepseek-v4-flash")).toEqual({
      perDispatchWallTimeMs: 300_000,
      bodyIdleTimeoutMs: 120_000,
    });
  });

  it("keeps every body idle budget clear of the wall by the re-dispatch floor", () => {
    const REDISPATCH_FLOOR_MS = 60_000; // execute.ts TIMEOUT_RETRY_MIN_REMAINING_MS — not exported for a test
    const modelIds = [
      "",
      "glm-4.5-flash",
      "glm-4.7-flash",
      "glm-5.2",
      "glm-4.6",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-5.2",
    ];
    let declared = 0;
    for (const productId of Object.keys(HOSTED_PROFILES)) {
      for (const modelId of modelIds) {
        const pacing = resolveDispatchPacing(productId, modelId);
        if (pacing.bodyIdleTimeoutMs === undefined) continue;
        declared += 1;
        if (pacing.perDispatchWallTimeMs === undefined) {
          throw new Error(`${productId} declares a body idle budget without a wall`);
        }
        expect(pacing.bodyIdleTimeoutMs).toBeGreaterThan(0);
        const idleThenRedispatchMs = pacing.bodyIdleTimeoutMs + REDISPATCH_FLOOR_MS;
        expect(idleThenRedispatchMs).toBeLessThan(pacing.perDispatchWallTimeMs);
      }
    }
    expect(declared).toBeGreaterThan(0);
  });

  it("returns no pacing for a non-hosted product", () => {
    expect(resolveDispatchPacing("local-http", "glm-5.2")).toEqual({});
  });

  it("returns no pacing for a hosted product without a pacing block", () => {
    expect(resolveDispatchPacing("gemini", "gemini-2.5-pro")).toEqual({});
  });
});
