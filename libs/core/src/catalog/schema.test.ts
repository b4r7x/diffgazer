import { describe, expect, it } from "vitest";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import { requireValue } from "../testing/assertions.js";
import { RAW_CATALOG, RAW_CATALOG_WITH_BAD_MODEL } from "./fixtures.js";
import {
  CatalogModelNameSchema,
  CatalogObservationSchema,
  CatalogSelectableModelIdSchema,
  ModelsDevModelSchema,
  parseModelsDevCatalog,
} from "./schema.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";

describe("parseModelsDevCatalog", () => {
  it("parses the exact upstream observations without product admission fields", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    expect(Object.keys(catalog)).toEqual([
      "google",
      "zai",
      "groq",
      "cerebras",
      "openrouter",
      "mistral",
    ]);
    expect(catalog).not.toHaveProperty(REMOVED_PRODUCT_ID);
    expect(catalog).not.toHaveProperty("zai-coding-plan");
    for (const provider of Object.values(catalog)) {
      expect(provider).not.toHaveProperty("enabled");
      expect(provider).not.toHaveProperty("selectable");
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

  it("accepts bounded display names and rejects secret, path, and control payloads", () => {
    expect(CatalogModelNameSchema.safeParse("Gemini 2.5 Flash").success).toBe(true);
    expect(CatalogModelNameSchema.safeParse("é".repeat(256)).success).toBe(true);

    for (const name of [
      "sk-live-adversarial-secret",
      "apiKey: sk-live-adversarial-secret",
      "Bearer abcdefghijklmnop",
      "\u001b[31mhostile\u001b[0m",
      "model\u0000name",
      "Executable path: /usr/local/bin/diffgazer",
      "Auth file: C:\\Program Files\\Diffgazer\\auth.json",
      "\\\\build-host\\Program Files\\Diffgazer\\auth.json",
      "x".repeat(513),
      "é".repeat(257),
    ]) {
      expect(CatalogModelNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

  it("drops unsafe display names without dropping valid sibling models", () => {
    const catalog = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          safe: { id: "safe", name: "Safe model" },
          secret: { id: "secret", name: "apiKey: sk-live-adversarial-secret" },
          control: { id: "control", name: "Model\u001b[31m" },
          path: { id: "path", name: "/usr/local/bin/diffgazer" },
        },
      },
    });

    expect(Object.keys(catalog.google?.models ?? {})).toEqual(["safe"]);
  });

  it("accepts only safe exact model IDs for selection", () => {
    for (const modelId of ["glm-4.7", "openai/gpt-4o", "qwen3-coder-flash"]) {
      expect(CatalogSelectableModelIdSchema.safeParse(modelId).success, modelId).toBe(true);
    }

    for (const modelId of [
      "Gemini 2.5 Flash",
      "openai/gpt-4o/latest",
      "gpt-4o-latest",
      "latest",
      "provider/model/variant",
      "model\u001b[31m",
    ]) {
      expect(CatalogSelectableModelIdSchema.safeParse(modelId).success, modelId).toBe(false);
    }
  });

  it("keeps opaque upstream IDs as observations without making them selectable", () => {
    const parsed = CatalogObservationSchema.parse({
      source: "models.dev-live",
      checkedAt: CHECKED_AT,
      catalog: {
        upstream: {
          id: "upstream",
          models: {
            "Marketing Name (latest)": {
              id: "Marketing Name (latest)",
              name: "Marketing Name",
              selectable: true,
              enabled: true,
            },
          },
        },
      },
    });

    const model = parsed.catalog.upstream?.models["Marketing Name (latest)"];
    expect(model?.id).toBe("Marketing Name (latest)");
    expect(CatalogSelectableModelIdSchema.safeParse(model?.id).success).toBe(false);
    expect(model).not.toHaveProperty("selectable");
    expect(model).not.toHaveProperty("enabled");
    expect(parsed).not.toHaveProperty("ready");
    expect(parsed).not.toHaveProperty("admitted");
  });

  it("requires a known observation source and checkedAt timestamp", () => {
    const catalog = { upstream: { id: "upstream", models: {} } };

    expect(CatalogObservationSchema.safeParse({ checkedAt: CHECKED_AT, catalog }).success).toBe(
      false,
    );
    expect(CatalogObservationSchema.safeParse({ source: "models.dev-live", catalog }).success).toBe(
      false,
    );
    expect(
      CatalogObservationSchema.safeParse({
        source: "marketing-page",
        checkedAt: CHECKED_AT,
        catalog,
      }).success,
    ).toBe(false);
    expect(
      CatalogObservationSchema.safeParse({
        source: "models.dev-snapshot",
        checkedAt: "yesterday",
        catalog,
      }).success,
    ).toBe(false);
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
