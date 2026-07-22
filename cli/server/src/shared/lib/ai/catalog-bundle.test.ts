import {
  assertCatalogSnapshotBundleEvidence,
  CATALOG_SNAPSHOT,
  getCatalogSnapshotBundleEvidence,
  PROVIDER_OVERLAY,
  SURFACED_OVERLAYS,
} from "@diffgazer/core/catalog";
import { describe, expect, it } from "vitest";

describe("CATALOG_SNAPSHOT bundle evidence", () => {
  const otherBundledCatalogInputs = { PROVIDER_OVERLAY, SURFACED_OVERLAYS };

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
