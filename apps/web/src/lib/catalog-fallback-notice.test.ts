import { getDateLabel, getTimestamp } from "@diffgazer/core/format";
import { describe, expect, it } from "vitest";
import { getCatalogFallbackNotice } from "./catalog-fallback-notice";

describe("getCatalogFallbackNotice", () => {
  it("renders the raw ISO stamp as a readable fetch time for cached catalog data", () => {
    expect(getCatalogFallbackNotice("cache", "2026-06-02T00:00:00.000Z")).toBe(
      `Using cached catalog data from ${getDateLabel("2026-06-02T00:00:00.000Z")} at ${getTimestamp(
        "2026-06-02T00:00:00.000Z",
      )}.`,
    );
    expect(getCatalogFallbackNotice("cache", "2026-06-02T00:00:00.000Z")).not.toContain(
      "2026-06-02T00:00:00.000Z",
    );
  });

  it("falls back to an unknown time when the cache has no timestamp", () => {
    expect(getCatalogFallbackNotice("cache", null)).toBe(
      "Using cached catalog data from an unknown time.",
    );
  });

  it("explains the bundled snapshot when live data is unavailable", () => {
    expect(getCatalogFallbackNotice("snapshot", null)).toBe(
      "Using the bundled model catalog because live catalog data is unavailable.",
    );
  });

  it("returns no notice for live or unknown sources", () => {
    expect(getCatalogFallbackNotice("live", "2026-06-02T00:00:00.000Z")).toBeNull();
    expect(getCatalogFallbackNotice(null, null)).toBeNull();
  });
});
