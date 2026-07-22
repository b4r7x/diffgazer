import { describe, expect, it } from "vitest";
import { parseModelsDevCatalog } from "./schema.js";
import { mergeModelsAcrossSources } from "./transform.js";

describe("mergeModelsAcrossSources", () => {
  it("merges by id across alias modelsDevIds, keeping the freshest last_updated entry", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Old Name",
            cost: { input: 1, output: 1 },
            last_updated: "2024-01-01",
          },
          "google-only": {
            id: "google-only",
            name: "Google Only",
            cost: { input: 1, output: 1 },
            last_updated: "2024-06-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "New Name",
            cost: { input: 2, output: 2 },
            last_updated: "2025-12-01",
          },
          "extra-only": {
            id: "extra-only",
            name: "Extra Only",
            cost: { input: 3, output: 3 },
            last_updated: "2025-01-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    const byId = new Map(merged.map((m) => [m.id, m]));

    expect(byId.get("dup-model")?.name).toBe("New Name");
    expect(byId.get("dup-model")?.last_updated).toBe("2025-12-01");
    expect(byId.get("google-only")?.name).toBe("Google Only");
    expect(byId.get("extra-only")?.name).toBe("Extra Only");
    expect(merged).toHaveLength(3);
  });

  it("ranks a real last_updated above an entry carrying only a newer release_date", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Has last_updated",
            cost: { input: 1, output: 1 },
            last_updated: "2025-12-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Release only",
            cost: { input: 2, output: 2 },
            release_date: "2026-01-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Has last_updated");
  });

  it("falls back to release_date when no entry carries last_updated, newest winning", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Older release",
            cost: { input: 1, output: 1 },
            release_date: "2024-01-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Newer release",
            cost: { input: 2, output: 2 },
            release_date: "2025-06-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Newer release");
  });

  it("keeps the first-seen entry when neither duplicate carries any date", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": { id: "dup-model", name: "First seen", cost: { input: 1, output: 1 } },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": { id: "dup-model", name: "Second seen", cost: { input: 2, output: 2 } },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("First seen");
  });
});
