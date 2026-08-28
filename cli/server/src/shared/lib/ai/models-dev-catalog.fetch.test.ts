import { parseModelsDevCatalog } from "@diffgazer/core/catalog";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeChunkedResponse } from "../testing/http.js";
import { MODELS_DEV_SAMPLE } from "../testing/models-dev-sample.js";
import { ModelsDevCatalogCacheSchema } from "./models-dev-catalog/cache.js";
import { fetchModelsDevCatalog } from "./models-dev-catalog/fetch.js";
import { modelInfoFromBoundedObservation } from "./models-dev-catalog/models.js";

const okResponse = (body: unknown, headers?: Record<string, string>): Response =>
  ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body }) as Response;
const fresh = (): string => new Date().toISOString();
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchModelsDevCatalog", () => {
  it("fetches keylessly with a 10s timeout signal and parses the catalog", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.catalog.google).toBeDefined();
      expect(result.value.catalog.openrouter).toBeDefined();
      expect(result.value.revalidated).toBe(false);
    }
    expect(spy).toHaveBeenCalledWith(
      "https://models.dev/api.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const [, init] = requireValue(spy.mock.calls[0], "fetch call");
    expect((init as RequestInit)?.headers).toBeUndefined();
  });

  it("carries the response ETag so the next refresh can be conditional", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse(MODELS_DEV_SAMPLE, { etag: '"catalog-v1"' }),
    );
    const result = await fetchModelsDevCatalog();
    expect(result.ok && result.value.etag).toBe('"catalog-v1"');
  });

  it("revalidates with If-None-Match and keeps the cached catalog on 304", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 304, headers: new Headers() } as Response);
    const cached = parseModelsDevCatalog(MODELS_DEV_SAMPLE);
    const result = await fetchModelsDevCatalog({
      revalidate: { etag: '"catalog-v1"', catalog: cached },
    });

    const [, init] = requireValue(spy.mock.calls[0], "fetch call");
    expect((init as RequestInit).headers).toEqual({ "if-none-match": '"catalog-v1"' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ catalog: cached, etag: '"catalog-v1"', revalidated: true });
    }
  });

  it("replaces a revalidated catalog when models.dev answers 200 with new content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse(MODELS_DEV_SAMPLE, { etag: '"catalog-v2"' }),
    );
    const result = await fetchModelsDevCatalog({
      revalidate: { etag: '"catalog-v1"', catalog: { google: { id: "google", models: {} } } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revalidated).toBe(false);
      expect(result.value.etag).toBe('"catalog-v2"');
      expect(result.value.catalog.openrouter).toBeDefined();
    }
  });

  it("rejects redirects so a 3xx to a foreign host cannot poison the cache", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    await fetchModelsDevCatalog();
    const [, init] = requireValue(spy.mock.calls[0], "fetch call");
    expect((init as RequestInit)?.redirect).toBe("error");
  });

  it("refuses a response whose Content-Length exceeds the ceiling, before buffering the body", async () => {
    const json = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(64 * 1024 * 1024) }),
      json,
    } as unknown as Response);
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
    expect(json).not.toHaveBeenCalled();
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("too large");
  });

  it("refuses a chunked response whose body exceeds the ceiling without Content-Length", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeChunkedResponse(
        `{"google":{"id":"google","models":{"big":{"id":"big","name":"${"x".repeat(MAX_RESPONSE_BYTES)}"}}}}`,
      ),
    );

    const result = await fetchModelsDevCatalog();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("too large");
  });

  it("returns an error on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 } as Response);
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("503");
  });

  it("returns an error when the network call throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("network down");
  });

  it("rejects a catalog that shrank far below the baseline (shrink-guard)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await fetchModelsDevCatalog({ baselineModelCount: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("shrink");
  });

  it("rejects a payload where most raw models were dropped by per-model parsing (corruption guard)", async () => {
    // 10 raw models, only 2 structurally valid: a silent mass-drop the total-count
    // guard cannot see because it counts post-parse survivors, not raw upstream size.
    const models: Record<string, unknown> = {
      "valid-a": { id: "valid-a", name: "A" },
      "valid-b": { id: "valid-b", name: "B" },
    };
    for (let i = 0; i < 8; i++)
      models[`broken-${i}`] = { name: "missing id and bad cost", cost: "nope" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models } }),
    );

    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
  });
});

describe("modelInfoFromBoundedObservation", () => {
  it("serves only checked observations and keeps snapshot/live sources distinct", () => {
    const checkedAt = fresh();
    const catalog = parseModelsDevCatalog(MODELS_DEV_SAMPLE);
    const liveModels = modelInfoFromBoundedObservation(
      catalog,
      "gemini",
      "models.dev-live",
      checkedAt,
    );
    const snapshotModels = modelInfoFromBoundedObservation(
      catalog,
      "gemini",
      "models.dev-snapshot",
      checkedAt,
    );

    expect(liveModels.length).toBeGreaterThan(0);
    expect(snapshotModels.map((model) => model.id)).toEqual(liveModels.map((model) => model.id));
    expect(liveModels.every((model) => !("enabled" in model) && !("selectable" in model))).toBe(
      true,
    );
    expect(JSON.stringify(liveModels)).not.toContain('"enabled"');
    expect(JSON.stringify(snapshotModels)).not.toContain('"liveEvidence"');
  });

  it("takes each model's tier from its published price, not from its provider", () => {
    const catalog = parseModelsDevCatalog(MODELS_DEV_SAMPLE);
    const gemini = modelInfoFromBoundedObservation(catalog, "gemini", "models.dev-live", fresh());
    const zai = modelInfoFromBoundedObservation(catalog, "zai", "models.dev-live", fresh());

    // Priced upstream, and a declared provider free tier does not change that.
    expect(gemini.find((model) => model.id === "gemini-2.5-flash")?.tier).toBe("paid");
    expect(gemini.find((model) => model.id === "gemini-3-pro-preview")?.tier).toBe("paid");
    expect(zai.find((model) => model.id === "glm-5-turbo")?.tier).toBe("free");
  });

  it("offers every admitted text model, hiding a declared refusal only for strict-schema products", () => {
    const catalog = parseModelsDevCatalog(MODELS_DEV_SAMPLE);
    const zai = modelInfoFromBoundedObservation(catalog, "zai", "models.dev-live", fresh());
    const gemini = modelInfoFromBoundedObservation(catalog, "gemini", "models.dev-live", fresh());
    const openrouter = modelInfoFromBoundedObservation(
      catalog,
      "openrouter",
      "models.dev-live",
      fresh(),
    );

    // glm-4.7 declares it cannot, but Z.AI validates JSON mode locally;
    // openrouter's openai/gpt-oss-120b declares nothing at all and is listed
    // as-is. Rows come newest release first.
    expect(zai.map((model) => model.id)).toEqual(["glm-5-turbo", "glm-4.7-flash", "glm-4.7"]);
    expect(openrouter.map((model) => model.id)).toEqual([
      "openai/gpt-oss-120b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ]);
    // Gemini runs strict JSON schema, so its declared refusal stays hidden.
    expect(gemini.map((model) => model.id)).toEqual(["gemini-3-pro-preview", "gemini-2.5-flash"]);
  });

  it("carries the catalog display name so pickers need not fall back to the id", () => {
    const catalog = parseModelsDevCatalog(MODELS_DEV_SAMPLE);
    const models = modelInfoFromBoundedObservation(catalog, "gemini", "models.dev-live", fresh());

    expect(models.find((model) => model.id === "gemini-2.5-flash")?.name).toBe("Gemini 2.5 Flash");
  });
});

describe("ModelsDevCatalogCacheSchema", () => {
  it("accepts a legacy entry without a generation id", () => {
    expect(
      ModelsDevCatalogCacheSchema.safeParse({
        catalog: { google: { id: "google", models: {} } },
        fetchedAt: fresh(),
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed generation id", () => {
    expect(
      ModelsDevCatalogCacheSchema.safeParse({
        catalog: { google: { id: "google", models: {} } },
        fetchedAt: fresh(),
        generationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
  it("rejects an entry missing fetchedAt", () => {
    expect(
      ModelsDevCatalogCacheSchema.safeParse({ catalog: { google: { id: "google", models: {} } } })
        .success,
    ).toBe(false);
  });
});
