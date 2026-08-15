import { CATALOG_SNAPSHOT } from "@diffgazer/core/catalog";
import { describe, expect, it } from "vitest";
import { budgetWithinModelObservation, DEFAULT_CONFIGURATION_BUDGET } from "./store.js";
import { configPath, loadStore, readJson, secretsPath, writeJson } from "./store.test-support.js";

const CEREBRAS_ENDPOINT = "https://api.cerebras.ai/v1";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

describe("configuration budget ceilings", () => {
  it("ships a conservative default output cap below common provider maxima", () => {
    expect(DEFAULT_CONFIGURATION_BUDGET.outputTokens).toBe(8_192);
  });

  it("clamps output and input to a bundled catalog observation", () => {
    const clamped = budgetWithinModelObservation(DEFAULT_CONFIGURATION_BUDGET, {
      contextTokens: 131_072,
      outputTokens: 32_768,
    });

    expect(clamped.outputTokens).toBe(8_192);
    expect(clamped.inputTokens).toBe(122_880);
  });

  it("never widens configured local caps", () => {
    const budget = { ...DEFAULT_CONFIGURATION_BUDGET, inputTokens: 4_096, outputTokens: 2_048 };
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
          configurationId: "cfg-cerebras",
          revision: 1,
          transportFamily: "hosted-api",
          productId: "cerebras",
          input: {
            transportFamily: "hosted-api",
            productId: "cerebras",
            endpoint: CEREBRAS_ENDPOINT,
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
          configurationId: "cfg-cerebras",
          revision: 1,
          kind: "none",
          status: "active",
        },
      ],
    });
    const store = await loadStore();

    const selected = await store.runConfigurationAction({
      action: "select",
      configurationId: "cfg-cerebras",
      modelId: "gpt-oss-120b",
    });

    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.value.configuration?.selectedModelId).toBe("gpt-oss-120b");
    const persisted = readJson<{
      configurations: Array<{ budget: { inputTokens: number; outputTokens: number } }>;
    }>(configPath());
    expect(persisted.configurations[0]?.budget).toEqual({
      ...DEFAULT_CONFIGURATION_BUDGET,
      outputTokens: 8_192,
      inputTokens: 122_880,
    });
  });

  it("clamps a legacy persisted budget on load without rewriting the user's file", async () => {
    // Far above any published ceiling, so the catalog observation is provably
    // the binding constraint and the assertion survives a snapshot refresh.
    const legacyBudget = {
      ...DEFAULT_CONFIGURATION_BUDGET,
      inputTokens: 5_000_000,
      outputTokens: 1_000_000,
    };
    const catalogLimit = CATALOG_SNAPSHOT.cerebras?.models["gpt-oss-120b"]?.limit;
    if (catalogLimit?.context === undefined || catalogLimit.output === undefined) {
      throw new Error("Bundled snapshot is missing cerebras/gpt-oss-120b limits");
    }
    writeJson(configPath(), {
      schemaVersion: 2,
      settings: {},
      selectedConfigurationId: null,
      configurations: [
        {
          schemaVersion: 2,
          status: "supported",
          configurationId: "cfg-cerebras",
          revision: 1,
          transportFamily: "hosted-api",
          productId: "cerebras",
          input: {
            transportFamily: "hosted-api",
            productId: "cerebras",
            endpoint: CEREBRAS_ENDPOINT,
          },
          selectedModelId: "gpt-oss-120b",
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
          configurationId: "cfg-cerebras",
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
      ...legacyBudget,
      outputTokens: catalogLimit.output,
      inputTokens: catalogLimit.context - catalogLimit.output,
    });
    const persisted = readJson<{
      configurations: Array<{ budget: { inputTokens: number; outputTokens: number } }>;
    }>(configPath());
    expect(persisted.configurations[0]?.budget).toEqual(legacyBudget);
  });
});
