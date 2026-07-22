import { describe, expect, it } from "vitest";
import { requireValue } from "../testing/assertions.js";
import { RAW_CATALOG, RAW_CATALOG_WITH_BAD_MODEL } from "./fixtures.js";
import { ModelsDevModelSchema, parseModelsDevCatalog } from "./schema.js";

describe("parseModelsDevCatalog", () => {
  it("parses all six enabled providers from the trimmed live fixture", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    for (const id of ["google", "zai", "zai-coding-plan", "groq", "cerebras", "openrouter"]) {
      expect(catalog[id], `provider ${id} should parse`).toBeDefined();
    }
    expect(Object.keys(requireValue(catalog.google?.models, "Google provider models"))).toContain(
      "gemini-2.5-flash",
    );
  });

  it("preserves model fields the catalog reads (cost, limit, capability flags, dates)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const flash = requireValue(catalog.google?.models["gemini-2.5-flash"], "Gemini Flash model");
    expect(flash.cost).toEqual({ input: 0.3, output: 2.5, cache_read: 0.03 });
    expect(flash.limit?.context).toBe(1048576);
    expect(flash.tool_call).toBe(true);
    expect(flash.structured_output).toBe(true);
    expect(flash.last_updated).toBe("2025-06-05");
  });

  it("keeps a model with absent cost (cost stays undefined, not zeroed)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const embedding = requireValue(
      catalog.google?.models["gemini-embedding-001"],
      "Gemini embedding model",
    );
    expect(embedding.cost).toBeUndefined();
  });

  it("skips one malformed model but keeps its siblings (per-model safeParse)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG_WITH_BAD_MODEL);
    const models = requireValue(catalog.google?.models, "Google provider models");
    expect(models["broken-model"]).toBeUndefined();
    expect(models["gemini-2.5-flash"]).toBeDefined();
    expect(models["gemini-2.5-pro"]).toBeDefined();
    expect(Object.keys(models)).toHaveLength(2);
  });

  it("drops unknown top-level fields (non-strict) without throwing", () => {
    const raw = { google: { id: "google", models: {}, unknownField: 42 } };
    const catalog = parseModelsDevCatalog(raw);
    expect(catalog.google).toBeDefined();
    expect(Object.keys(requireValue(catalog.google, "Google provider"))).not.toContain(
      "unknownField",
    );
  });

  it("skips a provider that fails the provider-level shape, keeping valid siblings", () => {
    const raw = {
      google: { id: "google", models: { "gemini-2.5-flash": { id: "gemini-2.5-flash" } } },
      // id must be a string; this provider fails the provider-level safeParse.
      broken: { id: 42, models: {} },
    };
    const catalog = parseModelsDevCatalog(raw);
    expect(catalog.google).toBeDefined();
    expect(catalog.broken).toBeUndefined();
  });

  it("accepts structured_output: null (nullable badge hint, never a parse failure)", () => {
    const parsed = ModelsDevModelSchema.safeParse({ id: "x", structured_output: null });
    expect(parsed.success).toBe(true);
  });

  const UNSAFE_KEY_CASES: Array<{ key: string; raw: unknown }> = [
    {
      key: "__proto__",
      // __proto__ only lands as a genuine own key when it arrives as external JSON
      // data, as the real models.dev payload does — object-literal syntax would
      // instead set the prototype and never reach the code under test.
      raw: JSON.parse(
        '{"__proto__":{"id":"__proto__","name":"poisoned","models":{"__proto__":{"id":"poisoned","name":"poisoned"},"gemini-2.5-flash":{"id":"gemini-2.5-flash","name":"Flash"}}},"google":{"id":"google","models":{"__proto__":{"id":"poisoned","name":"poisoned"},"gemini-2.5-flash":{"id":"gemini-2.5-flash","name":"Flash"}}}}',
      ),
    },
    {
      key: "prototype",
      raw: {
        prototype: { id: "prototype", name: "poisoned", models: {} },
        google: {
          id: "google",
          models: {
            prototype: { id: "poisoned", name: "poisoned" },
            "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Flash" },
          },
        },
      },
    },
    {
      key: "constructor",
      raw: {
        constructor: { id: "constructor", name: "poisoned", models: {} },
        google: {
          id: "google",
          models: {
            constructor: { id: "poisoned", name: "poisoned" },
            "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Flash" },
          },
        },
      },
    },
  ];

  it.each(
    UNSAFE_KEY_CASES,
  )("drops a $key key at both the provider and nested-model level without poisoning the catalog, its models record, or Object.prototype", ({
    key,
    raw,
  }) => {
    const catalog = parseModelsDevCatalog(raw);
    const models = requireValue(catalog.google?.models, "Google provider models");

    expect(Object.hasOwn(catalog, key)).toBe(false);
    expect(Object.hasOwn(models, key)).toBe(false);
    expect(Object.getPrototypeOf(catalog)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(models)).toBe(Object.prototype);
    expect(catalog.google?.id).toBe("google");
    expect(models["gemini-2.5-flash"]?.id).toBe("gemini-2.5-flash");
    expect(Object.prototype).not.toHaveProperty("name");
  });
});
