import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CATALOG_SNAPSHOT,
  CatalogObservationSchema,
  isOfferableObservation,
  PROVIDER_DERIVED,
  PROVIDER_OVERLAY,
  transformCatalogObservation,
} from "@diffgazer/core/catalog";
import {
  CANDIDATE_VERDICTS,
  CATALOG_EMPTY_MODELS_REASON,
  PRODUCT_REGISTRY,
} from "@diffgazer/core/providers";
import { CANDIDATE_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import {
  assertCatalogSnapshotBundleEvidence,
  getCatalogSnapshotBundleEvidence,
} from "@diffgazer/core/testing/catalog-bundle-evidence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../testing/temp-home.js";
import {
  discoverConfigurationCatalog,
  getProviderModels,
  modelInfoFromBoundedObservation,
} from "./models-dev-catalog.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
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
    assertTempHome(diffgazerHome);
    process.env.DIFFGAZER_HOME = diffgazerHome;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  });

  // The catalog awaits every cache write and starts no background writer, so the temp home
  // only has to fall before DIFFGAZER_HOME is dropped, which `paths.ts` re-reads per call.
  afterEach(() => {
    rmSync(diffgazerHome, { recursive: true, force: true });
    delete process.env.DIFFGAZER_HOME;
    delete process.env.DIFFGAZER_OFFLINE;
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
      // Picker rows are the OFFERED subset — review-capable and admitted by the
      // product's model policy — so parity is measured against that subset
      // rather than every observed model, or every merely capable one.
      const offeredModelIds = observation.models
        .filter((model) => isOfferableObservation(observation.productId, model))
        .map((model) => String(model.modelId))
        .sort();

      if (offeredModelIds.length === 0) {
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
      expect(serverModels.models.map((model) => model.id).sort()).toEqual(offeredModelIds);

      const bounded = modelInfoFromBoundedObservation(
        CATALOG_SNAPSHOT,
        observation.productId,
        "models.dev-snapshot",
        CHECKED_AT,
      );
      expect(bounded.map((model) => model.id).sort()).toEqual(offeredModelIds);
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
      expect(discovery.models.map((model) => model.id).sort()).toEqual(offeredModelIds);
    }
  });

  // Owner evidence: the picker's Free tab reads `tier === "free"`, so it can only
  // be filled by a route the model policy admits. Pinned `:free` variants are
  // separately priced catalog identities and belong there; `openrouter/free` is
  // a router that names no downstream model and does not.
  it("fills the OpenRouter picker's free tab with pinned variants and no routers", async () => {
    const { models } = await getProviderModels("openrouter");
    const modelIds = models.map(({ id }) => id);

    expect(models.filter(({ tier }) => tier === "free").map(({ id }) => id)).toEqual([
      "google/gemma-4-26b-a4b-it:free",
      "liquid/lfm-2.5-2.6b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "openai/gpt-oss-20b:free",
    ]);
    expect(modelIds).toContain("qwen/qwen-plus-2025-07-28:thinking");
    expect(modelIds).not.toContain("openrouter/auto");
    expect(modelIds).not.toContain("openrouter/free");
  });

  // The retired allowlist pinned `mistral-small-2603`, which publishes no
  // `structured_output`, so the capability filter withheld it and left the
  // picker empty while the one capable Mistral model sat off-list.
  it("fills the Mistral picker with the capable model its allowlist withheld", async () => {
    const { models } = await getProviderModels("mistral");

    expect(models.map(({ id, tier }) => ({ id, tier }))).toEqual([
      { id: "mistral-medium-2604", tier: "paid" },
    ]);
  });
});
