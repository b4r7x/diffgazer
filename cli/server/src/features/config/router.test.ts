import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { resetRateLimitsForTests } from "../../shared/middlewares/rate-limit.js";

// Matches the catalog route's createRateLimitMiddleware maxRequests in router.ts.
const MODEL_FETCH_MAX_REQUESTS = 30;

let diffgazerHome: string;

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body } as Response;
}

async function loadRouter() {
  const { configRouter } = await import("./router.js");
  const app = new Hono();
  app.route("/config", configRouter);
  return app;
}

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-config-router-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.DIFFGAZER_OFFLINE = "";
  vi.resetModules();
  vi.restoreAllMocks();
  resetRateLimitsForTests();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  rmSync(diffgazerHome, { recursive: true, force: true });
});

describe("GET /config/provider/:id/models", () => {
  it("returns live models end to end, free-first and with the recommended flag (source: live)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({
      google: { id: "google", name: "Google", models: {
        // A paid model whose name sorts BEFORE the free one alphabetically, so only
        // the free-first contract (not the name tiebreak) can put flash first.
        "gemini-2.0-pro": { id: "gemini-2.0-pro", name: "Gemini 2.0 Pro", cost: { input: 1.25, output: 5 }, limit: { context: 1_000_000 }, tool_call: true },
        "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", cost: { input: 0.3, output: 2.5 }, limit: { context: 1_000_000 }, tool_call: true },
      } },
    }));

    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      models: { id: string; tier: string; recommended?: boolean }[];
      source: string;
      cached: boolean;
      fetchedAt: string;
    };
    expect(body.source).toBe("live");
    expect(body.cached).toBe(false);
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // gemini-2.5-flash is forced free + recommended; it must lead the paid gemini-2.0-pro.
    expect(body.models[0]).toMatchObject({ id: "gemini-2.5-flash", tier: "free", recommended: true });
    expect(body.models.map((m) => m.tier)).toEqual(["free", "paid"]);
  });

  it("falls back to the bundled snapshot when fetch fails and no disk cache exists (source: snapshot)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { models: unknown[]; source: string; cached: boolean };
    expect(body.source).toBe("snapshot");
    expect(body.cached).toBe(false);
    expect(body.models.length).toBeGreaterThan(0);
  });

  it("returns 400 VALIDATION_ERROR for an unknown provider id", async () => {
    const app = await loadRouter();
    const res = await app.request("/config/provider/not-a-provider/models");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 PROVIDER_DISABLED for a surfaced-but-disabled provider", async () => {
    const app = await loadRouter();
    const res = await app.request("/config/provider/mistral/models");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PROVIDER_DISABLED");
  });

  it("serves requests up to the window then rate-limits the next one (200 then 429)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const app = await loadRouter();

    const first = await app.request("/config/provider/gemini/models");
    expect(first.status).toBe(200);

    let lastStatus = first.status;
    for (let i = 1; i <= MODEL_FETCH_MAX_REQUESTS; i++) {
      lastStatus = (await app.request("/config/provider/gemini/models")).status;
    }
    expect(lastStatus).toBe(429);
  });

  it("serves a payload that satisfies ProviderModelsResponseSchema (never the raw blob)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { ProviderModelsResponseSchema } = await import("@diffgazer/core/schemas/config");
    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    const body = await res.json();
    expect(ProviderModelsResponseSchema.safeParse(body).success).toBe(true);
    expect(Object.keys(body as object).sort()).toEqual(["cached", "fetchedAt", "models", "source"]);
  });
});
