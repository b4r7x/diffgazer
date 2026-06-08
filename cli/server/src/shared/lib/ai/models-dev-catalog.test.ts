import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { ProviderModelsResponseSchema } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../../testing/assertions.js";
import {
  fetchModelsDevCatalog,
  getProviderModels,
  ModelsDevCatalogCacheSchema,
  resetCatalogParseMemo,
} from "./models-dev-catalog.js";
import { MODELS_DEV_SAMPLE } from "./models-dev-sample.js";

let testHome: string;
const cachePath = (): string => path.join(testHome, "models-dev.json");
const writeCache = (catalog: unknown, fetchedAt: string): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify({ catalog, fetchedAt }, null, 2)}\n`);
};
const readCache = (): unknown => JSON.parse(fs.readFileSync(cachePath(), "utf-8"));
const okResponse = (body: unknown, headers?: Record<string, string>): Response =>
  ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body }) as Response;
const chunkedResponse = (text: string, headers?: Record<string, string>): Response => {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        let offset = 0;
        const chunkSize = 64 * 1024;
        while (offset < bytes.length) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
          offset += chunkSize;
        }
        controller.close();
      },
    }),
  } as Response;
};
const fresh = (): string => new Date().toISOString();
const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

const ENABLED_PROVIDERS = (
  Object.entries(PROVIDER_OVERLAY) as [AIProvider, (typeof PROVIDER_OVERLAY)[AIProvider]][]
)
  .filter(([, overlay]) => overlay.enabled)
  .map(([id]) => id);

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-models-dev-"));
  process.env.DIFFGAZER_HOME = testHome;
  delete process.env.DIFFGAZER_OFFLINE;
  resetCatalogParseMemo();
  vi.restoreAllMocks();
});
afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  fs.rmSync(testHome, { recursive: true, force: true });
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
      chunkedResponse(
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

  it("accepts a catalog when no baseline is provided (first run)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    expect((await fetchModelsDevCatalog()).ok).toBe(true);
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
  it("accepts a keyless { catalog, fetchedAt } entry", () => {
    expect(
      ModelsDevCatalogCacheSchema.safeParse({
        catalog: { google: { id: "google", models: {} } },
        fetchedAt: fresh(),
      }).success,
    ).toBe(true);
  });
  it("rejects an entry missing fetchedAt", () => {
    expect(
      ModelsDevCatalogCacheSchema.safeParse({ catalog: { google: { id: "google", models: {} } } })
        .success,
    ).toBe(false);
  });
});

describe("getProviderModels — three-tier fallback", () => {
  it("live success: fetches, persists a valid round-tripping cache, tags source=live", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.cached).toBe(false);
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");

    // The persisted file must round-trip through the cache schema...
    const persisted = ModelsDevCatalogCacheSchema.safeParse(readCache());
    expect(persisted.success).toBe(true);

    // ...and a follow-up request must serve that fresh persisted cache without refetching.
    fetchSpy.mockClear();
    const followUp = await getProviderModels("gemini");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(followUp.source).toBe("cache");
    expect(followUp.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("fresh disk cache: serves cache without fetching, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
    expect(result.cached).toBe(true);
  });

  it("fetch fails with a stale disk cache: serves the stale cache, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("no disk and fetch fails: falls back to the bundled snapshot, source=snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("shrink-guarded live fetch with a stale cache baseline: serves the stale cache, not the snapshot", async () => {
    // Seed a non-zero baseline so the shrink-guard can actually trip.
    writeCache(MODELS_DEV_SAMPLE, stale());
    // A live payload with >0 models but far fewer than baseline*0.5 trips the shrink-guard.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    // The shrunken live payload must NOT have overwritten the trusted cache.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.google).toBeDefined();
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("empty live payload with no usable cache: falls back to the snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("DIFFGAZER_OFFLINE: never fetches, serves cache when present", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(MODELS_DEV_SAMPLE, stale());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
  });

  it("DIFFGAZER_OFFLINE with no cache: serves the snapshot, never fetches", async () => {
    process.env.DIFFGAZER_OFFLINE = "true";
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("snapshot");
  });

  it("never returns an empty model list for any enabled provider", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(ENABLED_PROVIDERS).toContain("zai-coding");
    expect(ENABLED_PROVIDERS).toContain("openrouter");
    for (const id of ENABLED_PROVIDERS) {
      expect((await getProviderModels(id)).models.length, `empty picker for ${id}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("returns a fetchedAt that satisfies the response contract's ISO datetime shape", async () => {
    // Date.parse accepts non-ISO strings ("2025/01/01", "December 17, 1995"); the
    // wire contract is z.string().datetime(), so validate against that schema to
    // catch a parseable-but-non-ISO fetchedAt the looser Date.parse check would miss.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const { fetchedAt } = await getProviderModels("gemini");
    expect(ProviderModelsResponseSchema.shape.fetchedAt.safeParse(fetchedAt).success).toBe(true);
  });

  it("a future-dated cache is not treated as fresh: it re-fetches rather than locking out refresh forever", async () => {
    // The cache is fully populated for gemini, so the only reason to leave the
    // fresh-cache tier is the freshness bound. A one-sided "now - time < TTL"
    // check reads a future timestamp as permanently fresh and never refreshes;
    // a bound that rejects future dates re-fetches and serves the live catalog.
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    writeCache(MODELS_DEV_SAMPLE, future);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await getProviderModels("gemini");
    expect(spy).toHaveBeenCalled();
    expect(result.source).toBe("live");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("serves a new cache generation after the on-disk cache is replaced", async () => {
    // Guards the per-generation parse memo: a second, distinct cache generation
    // (different fetchedAt and contents) must be reflected, never a stale memo.
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const first = await getProviderModels("gemini");
    expect(first.models.map((m) => m.id)).toContain("gemini-2.5-flash");

    const { google, ...withoutGoogle } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutGoogle, new Date(Date.now() + 1000).toISOString());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const second = await getProviderModels("gemini");
    // The new generation lacks google, so the fresh-cache tier yields nothing for
    // gemini and resolution falls through to the snapshot — proving the memo did
    // not pin the prior generation's parse.
    expect(second.source).toBe("snapshot");
    expect(second.models.length).toBeGreaterThan(0);
  });

  it("fresh cache missing the requested provider: never serves a blank picker, falls through to the snapshot", async () => {
    // A structurally-valid, fresh cache that simply lacks groq's source id. The
    // fresh-cache tier yields nothing for groq, so resolution falls through; with
    // the live fetch unavailable it must land on the bundled snapshot.
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutGroq, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("groq");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("stale cache missing the requested provider with offline fetch: falls back to the snapshot", async () => {
    const { cerebras, ...withoutCerebras } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutCerebras, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("cerebras");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("live fetch dropping one enabled provider: serves that provider from the trusted cache and does not overwrite it", async () => {
    // Trusted (stale) cache holds every sample provider, so a fetch is attempted.
    writeCache(MODELS_DEV_SAMPLE, stale());
    // Live payload is overall healthy but has dropped groq entirely.
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutGroq));

    const result = await getProviderModels("groq");
    // The picker for groq must not be blank: it is served from the trusted cache.
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("cache");

    // The provider-dropping payload must NOT have poisoned the on-disk cache.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("live fetch dropping a provider while serving another: refuses to persist the poisoned catalog", async () => {
    // Trusted (stale) cache holds every sample provider; the requested provider
    // (gemini) is still present in the live payload, but groq was dropped.
    writeCache(MODELS_DEV_SAMPLE, stale());
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutGroq));

    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.models.length).toBeGreaterThan(0);

    // The dropped provider must survive in the on-disk cache: the trusted cache
    // is not overwritten by a catalog that loses an enabled provider.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("disk-write failure on a live fetch: still serves the fetched models, never throws out of the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    // Make the cache directory read-only so the atomic write fails at the real fs
    // boundary (EACCES), exactly like ENOSPC/EROFS in the field. No cache file
    // exists, so the read path is a clean first run.
    fs.chmodSync(testHome, 0o500);
    try {
      const result = await getProviderModels("gemini");
      expect(result.source).toBe("live");
      expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
      expect(fs.existsSync(cachePath())).toBe(false);
    } finally {
      fs.chmodSync(testHome, 0o700);
    }
  });

  it("corrupt cache file present: quarantines it and uses the snapshot baseline to guard a degenerate live fetch", async () => {
    fs.writeFileSync(cachePath(), "{ this is not valid json");
    // A live payload with a single model is non-zero, so it would slip past a
    // baseline-of-zero shrink-guard (the first-run accept path). With the bundled
    // snapshot supplying the emergency baseline, the shrink-guard trips and the
    // half-populated catalog is rejected in favor of the snapshot.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        google: {
          id: "google",
          models: { "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" } },
        },
      }),
    );
    const result = await getProviderModels("gemini");
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("snapshot");
    // The corrupt file is quarantined (renamed), not left in place to keep failing.
    expect(fs.existsSync(cachePath())).toBe(false);
    expect(fs.readdirSync(testHome).some((f) => f.includes(".backup"))).toBe(true);
  });
});
