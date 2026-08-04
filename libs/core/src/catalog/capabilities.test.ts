import { describe, expect, expectTypeOf, it } from "vitest";
import type { RunnableProductId } from "../schemas/config/transports.js";
import { deriveCapabilities, type ModelCapabilityObservation } from "./capabilities.js";
import { RAW_CATALOG } from "./fixtures.js";
import {
  type CatalogSelectableModelId,
  CatalogSelectableModelIdSchema,
  parseModelsDevCatalog,
} from "./schema.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const FRESH_AFTER = "2026-07-31T11:00:00.000Z";
const catalog = parseModelsDevCatalog(RAW_CATALOG);

function observe(productId: RunnableProductId) {
  return deriveCapabilities(catalog, productId, {
    source: "models.dev-snapshot",
    checkedAt: CHECKED_AT,
    freshAfter: FRESH_AFTER,
  });
}

describe("catalog capability observations", () => {
  it("carries the validated catalog model-id type through observations and evidence", () => {
    expectTypeOf<ModelCapabilityObservation["modelId"]>().toEqualTypeOf<CatalogSelectableModelId>();
    expectTypeOf<
      ModelCapabilityObservation["evidence"]["exactModelId"]
    >().toEqualTypeOf<CatalogSelectableModelId>();

    const [observation] = observe("gemini");
    expect(observation).toBeDefined();
    const parsedModelId = CatalogSelectableModelIdSchema.safeParse(observation?.modelId);
    expect(parsedModelId.success).toBe(true);
    expect(observation?.evidence.exactModelId).toBe(observation?.modelId);
  });

  it("emits volatile exact-model observations only with structured-output evidence", () => {
    const observations = observe("gemini");
    const flash = observations.find((observation) => observation.modelId === "gemini-2.5-flash");

    expect(flash).toEqual({
      productId: "gemini",
      modelId: "gemini-2.5-flash",
      source: "models.dev-snapshot",
      checkedAt: CHECKED_AT,
      evidence: {
        exactModelId: "gemini-2.5-flash",
        structuredOutput: "catalog-observed",
      },
      observedCapabilities: ["structured-output", "tool-calling", "reasoning"],
      limits: { contextTokens: 1_048_576, outputTokens: 65_536 },
    });
    expect(observations.some((observation) => observation.modelId === "gemini-embedding-001")).toBe(
      false,
    );
  });

  it("does not turn catalog prices or capability hints into readiness, free, or privacy claims", () => {
    const zeroPriced = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "gemini-2.5-flash": {
            id: "gemini-2.5-flash",
            cost: { input: 0, output: 0 },
            structured_output: true,
          },
        },
      },
    });
    const [observation] = deriveCapabilities(zeroPriced, "gemini", {
      source: "models.dev-live",
      checkedAt: CHECKED_AT,
      freshAfter: FRESH_AFTER,
    });

    expect(observation?.modelId).toBe("gemini-2.5-flash");
    for (const forbidden of [
      "ready",
      "selectable",
      "enabled",
      "free",
      "tier",
      "tierBadge",
      "private",
      "privacy",
      "admission",
      "conformance",
    ]) {
      expect(observation).not.toHaveProperty(forbidden);
    }
  });

  it("rejects stale or malformed observation times", () => {
    expect(
      deriveCapabilities(catalog, "gemini", {
        source: "models.dev-live",
        checkedAt: "2026-07-30T12:00:00.000Z",
        freshAfter: FRESH_AFTER,
      }),
    ).toEqual([]);
    expect(
      deriveCapabilities(catalog, "gemini", {
        source: "models.dev-live",
        checkedAt: "not-a-date",
        freshAfter: FRESH_AFTER,
      }),
    ).toEqual([]);
  });

  it("rejects latest aliases and model-key mismatches without rewriting exact IDs", () => {
    const aliases = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "kimi-latest": { id: "kimi-latest", structured_output: true },
          "model-LATEST-v2": { id: "model-LATEST-v2", structured_output: true },
          "model.latest.v2": { id: "model.latest.v2", structured_output: true },
          mismatch: { id: "actual-model", structured_output: true },
          "provider/model/variant": {
            id: "provider/model/variant",
            structured_output: true,
          },
          "provider/exact.model:1": {
            id: "provider/exact.model:1",
            structured_output: true,
          },
        },
      },
    });

    expect(
      deriveCapabilities(aliases, "gemini", {
        source: "models.dev-live",
        checkedAt: CHECKED_AT,
        freshAfter: FRESH_AFTER,
      }).map((observation) => observation.modelId),
    ).toEqual(["provider/exact.model:1"]);
  });

  it("requires positive structured-output evidence instead of inferring it", () => {
    expect(observe("zai")).toEqual([]);
  });
});
