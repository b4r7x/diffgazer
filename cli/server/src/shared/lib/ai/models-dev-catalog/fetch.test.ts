import { afterEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../../../testing/assertions.js";
import { makeChunkedResponse } from "../../testing/http.js";
import { fetchModelsDevCatalog, ModelsDevCatalogCacheSchema } from "../models-dev-catalog.js";
import { MODELS_DEV_SAMPLE } from "../models-dev-sample.js";

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
      expect(result.value.google).toBeDefined();
      expect(result.value.groq).toBeDefined();
    }
    expect(spy).toHaveBeenCalledWith(
      "https://models.dev/api.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const [, init] = requireValue(spy.mock.calls[0], "fetch call");
    expect((init as RequestInit)?.headers).toBeUndefined();
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
