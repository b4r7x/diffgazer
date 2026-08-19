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
  const parsed = parseModelsDevCatalog(raw);
  const trimmed = trimCatalogSnapshot(parsed, REQUIRED);
  return findCatalogSnapshotDefect(raw, parsed, trimmed, REQUIRED);
}

describe("findCatalogSnapshotDefect", () => {
  it("accepts a payload covering every required source with usable models", () => {
    expect(inspect(COMPLETE_PAYLOAD)).toBeNull();
  });

  it("rejects a syntactically valid error payload that survives parsing as an empty catalog", () => {
    const defect = inspect({ error: "rate limited" });

    expect(defect).toContain("missing sources: alpha, beta");
    expect(defect).toContain("raw models: 0");
    expect(defect).toContain("usable models: 0");
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
    expect(defect).toContain("usable models: 1");
  });

  it("reports raw-versus-survivor counts when models fail schema validation", () => {
    const defect = inspect({
      alpha: COMPLETE_PAYLOAD.alpha,
      beta: { id: "beta", models: { "beta-1": { id: "mismatched-id" } } },
    });

    expect(defect).toContain("sources without a usable model: beta");
    expect(defect).toContain("raw models: 2");
    expect(defect).toContain("usable models: 1");
  });

  it("names a malformed row the parser dropped from a required source that still has usable models", () => {
    const defect = inspect({
      ...COMPLETE_PAYLOAD,
      beta: {
        ...COMPLETE_PAYLOAD.beta,
        models: { ...COMPLETE_PAYLOAD.beta.models, "beta-3": { id: "beta-3", cost: "free" } },
      },
    });

    expect(defect).toContain("models dropped by the parser: beta/beta-3");
    expect(defect).not.toContain("sources without a usable model");
  });

  it("ignores rows the parser drops from sources nobody bundles", () => {
    expect(
      inspect({ ...COMPLETE_PAYLOAD, gamma: { id: "gamma", models: { bad: { id: "other" } } } }),
    ).toBeNull();
  });
});
