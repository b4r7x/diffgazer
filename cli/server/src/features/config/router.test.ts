import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ROOT_HEADER } from "../../shared/lib/paths.js";
import { resetRateLimitsForTests } from "../../shared/middlewares/rate-limit.js";
import { requireValue } from "../../testing/assertions.js";

// Matches the catalog route's createRateLimitMiddleware maxRequests in router.ts.
const MODEL_FETCH_MAX_REQUESTS = 30;

let diffgazerHome: string;
let projectRoot: string;

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
  projectRoot = mkdtempSync(join(tmpdir(), "dg-config-router-project-"));
  mkdirSync(join(projectRoot, ".git"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.DIFFGAZER_OFFLINE = "";
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  vi.resetModules();
  vi.restoreAllMocks();
  resetRateLimitsForTests();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  rmSync(diffgazerHome, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

async function grantProjectTrust(): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const store = getStore();
  const project = store.ensureProjectFile(projectRoot);
  const projectId = requireValue(project.projectId, "project id");
  await store.saveTrust({
    projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

describe("GET /config/init", () => {
  it("returns updated setup readiness after settings are saved", async () => {
    const app = await loadRouter();
    const before = await app.request("/config/init");
    expect(before.status).toBe(200);
    const beforeBody = (await before.json()) as { setup: { hasSecretsStorage: boolean } };
    expect(beforeBody.setup.hasSecretsStorage).toBe(false);

    const { getStore } = await import("../../shared/lib/config/store.js");
    await getStore().updateSettings({ secretsStorage: "file" });

    const after = await app.request("/config/init");
    expect(after.status).toBe(200);
    const afterBody = (await after.json()) as { setup: { hasSecretsStorage: boolean } };
    expect(afterBody.setup.hasSecretsStorage).toBe(true);
  });
});

describe("provider/config deletion aborts active sessions", () => {
  it("DELETE /config/provider/:id aborts sessions using that provider", async () => {
    await grantProjectTrust();
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    await store.updateSettings({ secretsStorage: "file" });
    await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "sk-test",
      model: "gemini-2.5-flash",
    });

    const sessions = await import("../review/stream/store.js");
    const session = sessions.createSession("provider-delete-review", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      mode: "unstaged",
      provider: "gemini",
    });
    sessions.markReady(session.reviewId);

    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini", {
      method: "DELETE",
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });
    expect(res.status).toBe(200);
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
    sessions.deleteSession(session.reviewId);
  });

  it("DELETE /config aborts sessions tied to the deleted active provider", async () => {
    await grantProjectTrust();
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    await store.updateSettings({ secretsStorage: "file" });
    await store.saveProviderCredentials({
      provider: "openrouter",
      apiKey: "sk-test",
      model: "openrouter/auto",
    });

    const sessions = await import("../review/stream/store.js");
    const session = sessions.createSession("config-delete-review", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      mode: "unstaged",
      provider: "openrouter",
    });
    sessions.markReady(session.reviewId);

    const app = await loadRouter();
    const res = await app.request("/config", {
      method: "DELETE",
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });
    expect(res.status).toBe(200);
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
    sessions.deleteSession(session.reviewId);
  });
});

describe("GET /config/provider/:id/models", () => {
  it("returns live models end to end, free-first and with the recommended flag (source: live)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        google: {
          id: "google",
          name: "Google",
          models: {
            // A paid model whose name sorts BEFORE the free one alphabetically, so only
            // the free-first contract (not the name tiebreak) can put flash first.
            "gemini-2.0-pro": {
              id: "gemini-2.0-pro",
              name: "Gemini 2.0 Pro",
              cost: { input: 1.25, output: 5 },
              limit: { context: 1_000_000 },
              tool_call: true,
            },
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              cost: { input: 0.3, output: 2.5 },
              limit: { context: 1_000_000 },
              tool_call: true,
            },
          },
        },
      }),
    );

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
    expect(body.models[0]).toMatchObject({
      id: "gemini-2.5-flash",
      tier: "free",
      recommended: true,
    });
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
