import { describe, it, expect } from "vitest";
import { parseModelsDevCatalog, ModelsDevModelSchema } from "./schema.js";
import { RAW_CATALOG, RAW_CATALOG_WITH_BAD_MODEL } from "./__fixtures__/catalog.fixture.js";

describe("parseModelsDevCatalog", () => {
  it("parses all six enabled providers from the trimmed live fixture", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    for (const id of ["google", "zai", "zai-coding-plan", "groq", "cerebras", "openrouter"]) {
      expect(catalog[id], `provider ${id} should parse`).toBeDefined();
    }
    expect(Object.keys(catalog["google"]!.models)).toContain("gemini-2.5-flash");
  });

  it("preserves model fields the catalog reads (cost, limit, capability flags, dates)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const flash = catalog["google"]!.models["gemini-2.5-flash"]!;
    expect(flash.cost).toEqual({ input: 0.3, output: 2.5, cache_read: 0.03 });
    expect(flash.limit?.context).toBe(1048576);
    expect(flash.tool_call).toBe(true);
    expect(flash.structured_output).toBe(true);
    expect(flash.last_updated).toBe("2025-06-05");
  });

  it("keeps a model with absent cost (cost stays undefined, not zeroed)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const embedding = catalog["google"]!.models["gemini-embedding-001"]!;
    expect(embedding.cost).toBeUndefined();
  });

  it("skips one malformed model but keeps its siblings (per-model safeParse)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG_WITH_BAD_MODEL);
    const models = catalog["google"]!.models;
    expect(models["broken-model"]).toBeUndefined();
    expect(models["gemini-2.5-flash"]).toBeDefined();
    expect(models["gemini-2.5-pro"]).toBeDefined();
    expect(Object.keys(models)).toHaveLength(2);
  });

  it("drops unknown top-level fields (non-strict) without throwing", () => {
    const raw = { google: { id: "google", models: {}, unknownField: 42 } };
    const catalog = parseModelsDevCatalog(raw);
    expect(catalog["google"]).toBeDefined();
    expect(Object.keys(catalog["google"]!)).not.toContain("unknownField");
  });

  it("skips a provider that fails the provider-level shape, keeping valid siblings", () => {
    const raw = {
      google: { id: "google", models: { "gemini-2.5-flash": { id: "gemini-2.5-flash" } } },
      // id must be a string; this provider fails the provider-level safeParse.
      broken: { id: 42, models: {} },
    };
    const catalog = parseModelsDevCatalog(raw);
    expect(catalog["google"]).toBeDefined();
    expect(catalog["broken"]).toBeUndefined();
  });

  it("accepts structured_output: null (nullable badge hint, never a parse failure)", () => {
    const parsed = ModelsDevModelSchema.safeParse({ id: "x", structured_output: null });
    expect(parsed.success).toBe(true);
  });
});
