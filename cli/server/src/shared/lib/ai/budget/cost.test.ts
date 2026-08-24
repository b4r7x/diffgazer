import { describe, expect, it, vi } from "vitest";

// The bundled catalog is generated output: pinning a real model's price or
// limit here would break on every regeneration, and it currently states an
// output limit for every priced model, so the absent-limit path needs a fixture.
vi.mock("@diffgazer/core/catalog", () => ({
  PROVIDER_OVERLAY: { gemini: { modelsDevIds: ["google"] } },
  CATALOG_SNAPSHOT: {
    google: {
      id: "google",
      name: "Google",
      models: {
        "priced-capped": {
          id: "priced-capped",
          name: "Priced Capped",
          cost: { input: 1, output: 2 },
          limit: { context: 100_000, output: 8_000 },
        },
        "priced-over-clamp": {
          id: "priced-over-clamp",
          name: "Priced Over Clamp",
          cost: { input: 1, output: 2 },
          limit: { context: 1_000_000, output: 100_000 },
        },
        "priced-uncapped": {
          id: "priced-uncapped",
          name: "Priced Uncapped",
          cost: { input: 1, output: 2 },
          limit: { context: 100_000 },
        },
        "priced-zero-cap": {
          id: "priced-zero-cap",
          name: "Priced Zero Cap",
          cost: { input: 1, output: 2 },
          limit: { context: 100_000, output: 0 },
        },
        unpriced: {
          id: "unpriced",
          name: "Unpriced",
          limit: { context: 100_000, output: 8_000 },
        },
      },
    },
  },
}));

const {
  estimateUsageCostUsd,
  estimateWorstCaseCostUsd,
  PLANNING_OUTPUT_TOKENS,
  resolveModelOutputLimit,
} = await import("./cost.js");

const INPUT_CAP = { maxInputTokens: 10_000 };

describe("resolveModelOutputLimit", () => {
  it("reports the catalog output ceiling", () => {
    expect(resolveModelOutputLimit("gemini", "priced-capped")).toBe(8_000);
  });

  it("reports no ceiling when the catalog states none", () => {
    expect(resolveModelOutputLimit("gemini", "priced-uncapped")).toBeNull();
  });

  it("reads a stated zero as no ceiling", () => {
    expect(resolveModelOutputLimit("gemini", "priced-zero-cap")).toBeNull();
  });

  it("reports no ceiling for a model the catalog does not carry", () => {
    expect(resolveModelOutputLimit("gemini", "absent-model")).toBeNull();
  });
});

describe("estimateWorstCaseCostUsd", () => {
  it("reserves the input cap plus a catalog output ceiling below the planning clamp", () => {
    // 10_000 tokens at $1/M + 8_000 tokens at $2/M.
    expect(estimateWorstCaseCostUsd("gemini", "priced-capped", INPUT_CAP)).toBeCloseTo(0.026, 10);
  });

  it("prices the planning clamp for a model whose catalog ceiling runs past it", () => {
    // 10_000 tokens at $1/M + 32_768 planned output tokens at $2/M, not the
    // 100_000-token catalog ceiling.
    expect(PLANNING_OUTPUT_TOKENS).toBe(32_768);
    expect(estimateWorstCaseCostUsd("gemini", "priced-over-clamp", INPUT_CAP)).toBeCloseTo(
      0.075_536,
      10,
    );
  });

  it("reserves input only when the catalog states no output ceiling", () => {
    expect(estimateWorstCaseCostUsd("gemini", "priced-uncapped", INPUT_CAP)).toBeCloseTo(0.01, 10);
  });

  it("reserves nothing for a model the catalog does not price", () => {
    expect(estimateWorstCaseCostUsd("gemini", "unpriced", INPUT_CAP)).toBeNull();
  });
});

describe("estimateUsageCostUsd", () => {
  it("still settles observed output tokens", () => {
    const pricing = { inputPerTokenUsd: 0.000_001, outputPerTokenUsd: 0.000_002 };
    expect(estimateUsageCostUsd(pricing, { inputTokens: 1_000, outputTokens: 500 })).toBeCloseTo(
      0.002,
      10,
    );
  });
});
