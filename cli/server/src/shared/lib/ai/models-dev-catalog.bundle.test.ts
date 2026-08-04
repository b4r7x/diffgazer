import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertCatalogSnapshotBundleEvidence,
  CATALOG_SNAPSHOT,
  CatalogObservationSchema,
  getCatalogSnapshotBundleEvidence,
  PROVIDER_DERIVED,
  PROVIDER_OVERLAY,
  projectCatalogAvailabilityObservations,
  transformCatalogObservation,
} from "@diffgazer/core/catalog";
import { CANDIDATE_VERDICTS, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { CANDIDATE_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverConfigurationCatalog,
  getProviderModels,
  modelInfoFromBoundedObservation,
} from "./models-dev-catalog.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const CATALOG_EMPTY_MODELS_REASON =
  "No catalog models are available for this configuration product.";
const otherBundledCatalogInputs = {
  PROVIDER_OVERLAY,
  PROVIDER_DERIVED,
  PRODUCT_REGISTRY,
};

const snapshotObservations = () =>
  transformCatalogObservation({
    source: "models.dev-snapshot",
    checkedAt: CHECKED_AT,
    catalog: CATALOG_SNAPSHOT,
  });

describe("CATALOG_SNAPSHOT bundle evidence", () => {
  it("accepts the real bundled snapshot", () => {
    const evidence = getCatalogSnapshotBundleEvidence(CATALOG_SNAPSHOT, [
      otherBundledCatalogInputs,
    ]);

    expect(() =>
      assertCatalogSnapshotBundleEvidence(JSON.stringify(CATALOG_SNAPSHOT), evidence),
    ).not.toThrow();
  });

  it("rejects a complete overlay bundle with the snapshot removed", () => {
    const evidence = getCatalogSnapshotBundleEvidence(CATALOG_SNAPSHOT, [
      otherBundledCatalogInputs,
    ]);

    expect(() =>
      assertCatalogSnapshotBundleEvidence(JSON.stringify(otherBundledCatalogInputs), evidence),
    ).toThrowError(/CATALOG_SNAPSHOT evidence missing/);
  });
});

describe("bundled catalog observations", () => {
  let diffgazerHome: string;

  beforeEach(() => {
    process.env.DIFFGAZER_OFFLINE = "1";
    // An empty temp home keeps the real ~/.diffgazer models-dev.json cache out
    // of the snapshot-tier assertions below.
    diffgazerHome = mkdtempSync(join(tmpdir(), "dg-catalog-bundle-"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_OFFLINE;
    delete process.env.DIFFGAZER_HOME;
    rmSync(diffgazerHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("keeps bundled observation parity without product or admission authority", async () => {
    expect(
      CatalogObservationSchema.safeParse({
        source: "models.dev-snapshot",
        checkedAt: CHECKED_AT,
        catalog: CATALOG_SNAPSHOT,
      }).success,
    ).toBe(true);
    expect(
      CatalogObservationSchema.safeParse({ checkedAt: CHECKED_AT, catalog: CATALOG_SNAPSHOT })
        .success,
    ).toBe(false);
    expect(
      CatalogObservationSchema.safeParse({
        source: "models.dev-snapshot",
        catalog: CATALOG_SNAPSHOT,
      }).success,
    ).toBe(false);

    const availability = projectCatalogAvailabilityObservations("models.dev-snapshot", CHECKED_AT);
    for (const observation of availability) {
      expect(observation).toEqual({
        productId: observation.productId,
        modelsDevIds: observation.modelsDevIds,
        source: "models.dev-snapshot",
        checkedAt: CHECKED_AT,
      });
      expect(observation).not.toHaveProperty("enabled");
      expect(observation).not.toHaveProperty("selectable");
    }

    const observations = snapshotObservations();
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every(({ source }) => source === "models.dev-snapshot")).toBe(true);
    expect(observations.some(({ source }) => source === "models.dev-live")).toBe(false);

    const productIds = new Set<string>(observations.map(({ productId }) => productId));
    const serialized = JSON.stringify(observations);

    expect(productIds.has("github-models")).toBe(false);
    for (const candidateId of CANDIDATE_PRODUCT_IDS) {
      expect(productIds.has(candidateId), candidateId).toBe(false);
    }
    for (const candidateId of Object.keys(CANDIDATE_VERDICTS)) {
      expect(productIds.has(candidateId), candidateId).toBe(false);
    }
    for (const forbidden of [
      "admitted",
      "conformance",
      "enabled",
      "liveEvidence",
      "ready",
      "selectable",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }

    for (const observation of observations) {
      expect(observation.checkedAt).toBe(CHECKED_AT);

      const configurationId = `cfg-${observation.productId}-bundle`;

      if (observation.models.length === 0) {
        const serverModels = await getProviderModels(observation.productId);
        expect(serverModels.source).toBe("snapshot");
        expect(serverModels.cached).toBe(false);
        expect(serverModels.models).toEqual([]);

        const bounded = modelInfoFromBoundedObservation(
          CATALOG_SNAPSHOT,
          observation.productId,
          "models.dev-snapshot",
          CHECKED_AT,
        );
        expect(bounded).toEqual([]);

        const discovery = await discoverConfigurationCatalog({
          configurationId,
          productId: observation.productId,
        });
        expect(discovery).toMatchObject({
          status: "skipped",
          configurationId,
          productId: observation.productId,
          models: [],
          reason: CATALOG_EMPTY_MODELS_REASON,
        });
        expect(discovery.status).not.toBe("passed");
        continue;
      }

      const serverModels = await getProviderModels(observation.productId);
      expect(serverModels.source).toBe("snapshot");
      expect(serverModels.cached).toBe(false);
      expect(serverModels.models.map((model) => model.id).sort()).toEqual(
        observation.models.map((model) => model.modelId).sort(),
      );

      const bounded = modelInfoFromBoundedObservation(
        CATALOG_SNAPSHOT,
        observation.productId,
        "models.dev-snapshot",
        CHECKED_AT,
      );
      expect(bounded.map((model) => model.id).sort()).toEqual(
        observation.models.map((model) => model.modelId).sort(),
      );
      expect(JSON.stringify(bounded)).not.toMatch(/"enabled"|"selectable"/);

      const discovery = await discoverConfigurationCatalog({
        configurationId,
        productId: observation.productId,
      });
      expect(discovery.status).toBe("passed");
      if (discovery.status !== "passed") throw new Error("Expected passed catalog discovery");
      expect(discovery.configurationId).toBe(configurationId);
      expect(discovery.source).toBe("snapshot");
      expect(discovery.observationSource).toBe("models.dev-snapshot");
      expect(discovery.observationSource).not.toBe("models.dev-live");
      expect(discovery.checkedAt).toBe(discovery.fetchedAt);
      expect(discovery.models.map((model) => model.id).sort()).toEqual(
        observation.models.map((model) => model.modelId).sort(),
      );
    }
  });
});
