import { describe, expect, it } from "vitest";
import { parseModelsDevCatalog } from "./schema.js";
import { findCatalogSnapshotDefect } from "./snapshot-guard.js";
import { trimCatalogSnapshot } from "./snapshot-trim.js";

const REQUIRED = new Set(["alpha", "beta"]);

function makeProvider(id: string, modelIds: string[]) {
  return {
    id,
    name: id,
    models: Object.fromEntries(
      modelIds.map((modelId) => [modelId, { id: modelId, name: modelId }]),
    ),
  };
}

const COMPLETE_PAYLOAD = {
  alpha: makeProvider("alpha", ["alpha-1"]),
  beta: makeProvider("beta", ["beta-1", "beta-2"]),
};

function inspect(raw: unknown) {
  const trimmed = trimCatalogSnapshot(parseModelsDevCatalog(raw), REQUIRED);
  return findCatalogSnapshotDefect(raw, trimmed, REQUIRED);
}

describe("findCatalogSnapshotDefect", () => {
  it("accepts a payload covering every required source with usable models", () => {
    expect(inspect(COMPLETE_PAYLOAD)).toBeNull();
  });

  it("rejects a syntactically valid error payload that survives parsing as an empty catalog", () => {
    const defect = inspect({ error: "rate limited" });

    expect(defect).toContain("missing sources: alpha, beta");
    expect(defect).toContain("raw models: 0");
    expect(defect).toContain("kept models: 0");
  });

  it("rejects a refresh that drops one required source", () => {
    const defect = inspect({ alpha: COMPLETE_PAYLOAD.alpha });

    expect(defect).toContain("missing sources: beta");
    expect(defect).not.toContain("alpha");
  });

  it("rejects a refresh whose required source keeps no usable model", () => {
    const defect = inspect({
      ...COMPLETE_PAYLOAD,
      beta: {
        id: "beta",
        models: {
          "beta-audio": { id: "beta-audio", modalities: { output: ["audio"] } },
        },
      },
    });

    expect(defect).toContain("sources without a usable model: beta");
    expect(defect).toContain("raw models: 2");
    expect(defect).toContain("kept models: 1");
  });

  it("reports raw-versus-survivor counts when models fail schema validation", () => {
    const defect = inspect({
      alpha: COMPLETE_PAYLOAD.alpha,
      beta: { id: "beta", models: { "beta-1": { id: "mismatched-id" } } },
    });

    expect(defect).toContain("sources without a usable model: beta");
    expect(defect).toContain("raw models: 2");
    expect(defect).toContain("kept models: 1");
  });
});
