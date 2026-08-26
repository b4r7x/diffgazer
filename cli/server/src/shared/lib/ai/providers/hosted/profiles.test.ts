import { describe, expect, it } from "vitest";
import { resolveDispatchPacing } from "./profiles.js";

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
    });
    expect(resolveDispatchPacing("openrouter", "openai/gpt-5.2")).toEqual({
      perDispatchWallTimeMs: 600_000,
    });
  });

  it("returns no pacing for a non-hosted product", () => {
    expect(resolveDispatchPacing("local-http", "glm-5.2")).toEqual({});
  });

  it("returns no pacing for a hosted product without a pacing block", () => {
    expect(resolveDispatchPacing("gemini", "gemini-2.5-pro")).toEqual({});
  });
});
