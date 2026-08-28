import { CATALOG_SNAPSHOT } from "@diffgazer/core/catalog";
import { describe, expect, it } from "vitest";
import { PLANNING_OUTPUT_TOKENS } from "../ai/budget/cost.js";
import { budgetWithinModelObservation, DEFAULT_CONFIGURATION_BUDGET } from "./store.js";
import { configPath, loadStore, readJson, secretsPath, writeJson } from "./store.test-support.js";

const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

describe("configuration budget ceilings", () => {
  it.each([
    ["the catalog output ceiling out of the model context window", 32_768, 98_304],
    // A ceiling above the planned answer length reserves only what a review plans to spend.
    ["only the planned answer length out of a large catalog ceiling", 98_304, 98_304],
    // A ceiling below it is reserved in full: a model that cannot emit 32k
    // tokens must not have 32k held back from its input.
    ["a catalog ceiling below the planned answer length in full", 8_192, 122_880],
    ["nothing when the catalog publishes no output ceiling", undefined, 131_072],
  ])("reserves %s", (_label, outputTokens, expectedInputTokens) => {
    const clamped = budgetWithinModelObservation(DEFAULT_CONFIGURATION_BUDGET, {
      contextTokens: 131_072,
      ...(outputTokens === undefined ? {} : { outputTokens }),
    });

    expect(clamped.inputTokens).toBe(expectedInputTokens);
  });

  it("never widens the configured local input cap", () => {
    const budget = { ...DEFAULT_CONFIGURATION_BUDGET, inputTokens: 4_096 };
    const clamped = budgetWithinModelObservation(budget, {
      contextTokens: 131_072,
      outputTokens: 32_768,
    });

    expect(clamped).toEqual(budget);
  });

  it("persists a model-clamped budget when an exact model is selected", async () => {
    writeJson(configPath(), {
      schemaVersion: 2,
      settings: {},
      selectedConfigurationId: null,
      configurations: [
        {
          schemaVersion: 2,
          status: "supported",
          configurationId: "cfg-zai",
          revision: 1,
          transportFamily: "hosted-api",
          productId: "zai",
          input: {
            transportFamily: "hosted-api",
            productId: "zai",
            endpoint: ZAI_ENDPOINT,
          },
          selectedModelId: null,
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
          evidenceReference: null,
          budget: DEFAULT_CONFIGURATION_BUDGET,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
      ],
    });
    writeJson(secretsPath(), {
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-zai",
          revision: 1,
          kind: "none",
          status: "active",
        },
      ],
    });
    const store = await loadStore();

    const selected = await store.runConfigurationAction({
      action: "select",
      configurationId: "cfg-zai",
      modelId: "glm-4.6",
    });

    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.value.configuration?.selectedModelId).toBe("glm-4.6");
    const persisted = readJson<{
      configurations: Array<{ budget: { inputTokens: number } }>;
    }>(configPath());
    expect(persisted.configurations[0]?.budget).toEqual({
      ...DEFAULT_CONFIGURATION_BUDGET,
      inputTokens: 172_032,
    });
  });

  it("clamps a legacy persisted budget on load without rewriting the user's file", async () => {
    // Far above any published ceiling, so the catalog observation is provably
    // the binding constraint and the assertion survives a snapshot refresh.
    const decodedLegacyBudget = { ...DEFAULT_CONFIGURATION_BUDGET, inputTokens: 5_000_000 };
    // Persisted files still carry the retired outputTokens dimension; reads strip it.
    const legacyBudget = { ...decodedLegacyBudget, outputTokens: 1_000_000 };
    const catalogLimit = CATALOG_SNAPSHOT.zai?.models["glm-4.6"]?.limit;
    if (catalogLimit?.context === undefined || catalogLimit.output === undefined) {
      throw new Error("Bundled snapshot is missing zai/glm-4.6 limits");
    }
    writeJson(configPath(), {
      schemaVersion: 2,
      settings: {},
      selectedConfigurationId: null,
      configurations: [
        {
          schemaVersion: 2,
          status: "supported",
          configurationId: "cfg-zai",
          revision: 1,
          transportFamily: "hosted-api",
          productId: "zai",
          input: {
            transportFamily: "hosted-api",
            productId: "zai",
            endpoint: ZAI_ENDPOINT,
          },
          selectedModelId: "glm-4.6",
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
          evidenceReference: null,
          budget: legacyBudget,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
      ],
    });
    writeJson(secretsPath(), {
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-zai",
          revision: 1,
          kind: "none",
          status: "active",
        },
      ],
    });
    const store = await loadStore();
    await store.ready();

    const current = await store.readCurrentState();
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const entry = current.value.config.configurations[0];
    expect(entry?.status === "supported" ? entry.record.budget : null).toEqual({
      ...decodedLegacyBudget,
      inputTokens: catalogLimit.context - Math.min(catalogLimit.output, PLANNING_OUTPUT_TOKENS),
    });
    const persisted = readJson<{
      configurations: Array<{ budget: { inputTokens: number; outputTokens: number } }>;
    }>(configPath());
    expect(persisted.configurations[0]?.budget).toEqual(legacyBudget);
  });
});
