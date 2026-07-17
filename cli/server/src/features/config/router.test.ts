import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApi } from "@diffgazer/core/api";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "../../shared/middlewares/rate-limit.js";
import { requireValue } from "../../testing/assertions.js";

// Matches the catalog route's createRateLimitMiddleware maxRequests in router.ts.
const MODEL_FETCH_MAX_REQUESTS = 30;

let diffgazerHome: string;
let projectRoot: string;
let originalPackaged: string | undefined;
let originalShutdownToken: string | undefined;

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body } as Response;
}

async function loadRouter() {
  const { configRouter } = await import("./router.js");
  const app = new Hono();
  app.route("/config", configRouter);
  return app;
}

async function loadApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-config-router-"));
  projectRoot = realpathSync.native(mkdtempSync(join(tmpdir(), "dg-config-router-project-")));
  mkdirSync(join(projectRoot, ".git"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.DIFFGAZER_OFFLINE = "";
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  originalPackaged = process.env.DIFFGAZER_PACKAGED;
  originalShutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
  delete process.env.DIFFGAZER_PACKAGED;
  delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
  vi.resetModules();
  vi.restoreAllMocks();
  resetRateLimitsForTests();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  if (originalPackaged === undefined) delete process.env.DIFFGAZER_PACKAGED;
  else process.env.DIFFGAZER_PACKAGED = originalPackaged;
  if (originalShutdownToken === undefined) delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
  else process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalShutdownToken;
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

async function saveOpenRouterCredentials(): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const store = getStore();
  await store.updateSettings({ secretsStorage: "file" });
  const saved = await store.saveProviderCredentials({
    provider: "openrouter",
    apiKey: "sk-test",
    model: "openrouter/auto",
  });
  expect(saved.ok).toBe(true);
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

  it("keeps an active provider with no readable credential in setup-required state", async () => {
    const app = await loadRouter();
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    vi.spyOn(store, "getProviders").mockReturnValue([
      {
        provider: "gemini",
        hasApiKey: true,
        isActive: true,
        model: "gemini-2.5-flash",
      },
    ]);
    vi.spyOn(store, "getProviderApiKey").mockReturnValue({ ok: true, value: null });

    const response = await app.request("/config/init");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      setup: { hasProvider: false, missing: expect.arrayContaining(["provider"]) },
    });
  });

  it.each([
    "KEYRING_UNAVAILABLE",
    "KEYRING_READ_FAILED",
  ] as const)("returns the concrete credential storage error %s", async (errorCode) => {
    const app = await loadRouter();
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    vi.spyOn(store, "getProviders").mockReturnValue([
      {
        provider: "gemini",
        hasApiKey: true,
        isActive: true,
        model: "gemini-2.5-flash",
      },
    ]);
    vi.spyOn(store, "getProviderApiKey").mockReturnValue({
      ok: false,
      error: { code: errorCode, message: "Credential storage unavailable" },
    });

    const response = await app.request("/config/init");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: errorCode } });
  });
});

describe("POST /config", () => {
  it("returns 500 when credential persistence fails", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    vi.spyOn(getStore(), "saveProviderCredentials").mockResolvedValue({
      ok: false,
      error: { code: "PERSIST_FAILED", message: "Failed to persist config" },
    });
    const app = await loadRouter();

    const response = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", apiKey: "test-key" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERSIST_FAILED" },
    });
  });

  it("keeps credential input failures at 400", async () => {
    const app = await loadRouter();

    const response = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "gemini",
        apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CREDENTIAL_INVALID" },
    });
  });
});

describe("POST /config/provider/:id/activate", () => {
  it.each([
    "KEYRING_READ_FAILED",
    "KEYRING_UNAVAILABLE",
  ] as const)("returns 500 when credential lookup fails with %s", async (errorCode) => {
    await grantProjectTrust();
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    vi.spyOn(store, "getProviders").mockReturnValue([
      {
        provider: "gemini",
        hasApiKey: true,
        isActive: false,
        model: "gemini-2.5-flash",
      },
    ]);
    vi.spyOn(store, "getProviderApiKey").mockReturnValue({
      ok: false,
      error: { code: errorCode, message: "Credential storage unavailable" },
    });
    const app = await loadRouter();

    const response = await app.request("/config/provider/gemini/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PROJECT_ROOT_HEADER]: projectRoot,
      },
      body: JSON.stringify({ model: "gemini-2.5-flash" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: errorCode },
    });
  });
});

describe("provider/config deletion aborts active sessions", () => {
  it("DELETE /config/provider/:id aborts that provider across projects only", async () => {
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
    const otherProjectRoot = realpathSync.native(
      mkdtempSync(join(tmpdir(), "dg-config-router-other-project-")),
    );
    const session = sessions.createSession("provider-delete-review", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
      provider: "gemini",
    });
    const otherProjectSession = sessions.createSession("provider-delete-other-project", {
      projectPath: otherProjectRoot,
      headCommit: "def456",
      statusHash: "hash456",
      statusHashKind: "full" as const,
      mode: "unstaged",
      provider: "gemini",
    });
    const otherProviderSession = sessions.createSession("provider-delete-other-provider", {
      projectPath: otherProjectRoot,
      headCommit: "ghi789",
      statusHash: "hash789",
      statusHashKind: "full" as const,
      mode: "unstaged",
      provider: "openrouter",
    });
    sessions.markReady(session.reviewId);
    sessions.markReady(otherProjectSession.reviewId);
    sessions.markReady(otherProviderSession.reviewId);

    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini", {
      method: "DELETE",
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });
    expect(res.status).toBe(200);
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
    expect(otherProjectSession.controller.signal.aborted).toBe(true);
    expect(otherProviderSession.controller.signal.aborted).toBe(false);
    sessions.deleteSession(session.reviewId);
    sessions.deleteSession(otherProjectSession.reviewId);
    sessions.deleteSession(otherProviderSession.reviewId);
    rmSync(otherProjectRoot, { recursive: true, force: true });
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
    const otherProjectRoot = realpathSync.native(
      mkdtempSync(join(tmpdir(), "dg-config-router-other-config-project-")),
    );
    const session = sessions.createSession("config-delete-review", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
      provider: "openrouter",
    });
    const otherProjectSession = sessions.createSession("config-delete-other-project", {
      projectPath: otherProjectRoot,
      headCommit: "def456",
      statusHash: "hash456",
      statusHashKind: "full" as const,
      mode: "unstaged",
      provider: "openrouter",
    });
    sessions.markReady(session.reviewId);
    sessions.markReady(otherProjectSession.reviewId);

    const app = await loadRouter();
    const res = await app.request("/config", {
      method: "DELETE",
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });
    expect(res.status).toBe(200);
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
    expect(otherProjectSession.controller.signal.aborted).toBe(true);
    sessions.deleteSession(session.reviewId);
    sessions.deleteSession(otherProjectSession.reviewId);
    rmSync(otherProjectRoot, { recursive: true, force: true });
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

  it("preserves a slash-bearing provider id through the core client and Hono route", async () => {
    const app = await loadApp();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const headers = new Headers(request.headers);
      headers.set("Host", new URL(request.url).host);
      return app.fetch(new Request(request, { headers }));
    });
    const api = createApi({ baseUrl: "http://localhost:3000" });
    const request = api.getProviderModels("unknown/provider");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/config/provider/unknown%2Fprovider/models",
      expect.any(Object),
    );
    await expect(request).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Unknown provider: unknown/provider",
    });
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

  it("coalesces concurrent catalog fetches and retries after a failed generation", async () => {
    const failedGeneration = createDeferred<Response>();
    const retryGeneration = createDeferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(failedGeneration.promise)
      .mockReturnValueOnce(retryGeneration.promise);
    const app = await loadRouter();

    const failedRequests = Array.from({ length: 8 }, () =>
      app.request("/config/provider/gemini/models"),
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    failedGeneration.reject(new Error("network down"));

    const failedResponses = await Promise.all(failedRequests);
    const failedBodies = await Promise.all(
      failedResponses.map(async (response) => {
        const body = (await response.json()) as { source: string; models: Array<{ id: string }> };
        return {
          status: response.status,
          source: body.source,
          ids: body.models.map(({ id }) => id),
        };
      }),
    );
    expect(
      failedBodies.every(({ status, source }) => status === 200 && source === "snapshot"),
    ).toBe(true);
    expect(new Set(failedBodies.map((body) => JSON.stringify(body))).size).toBe(1);

    const retryRequests = Array.from({ length: 8 }, () =>
      app.request("/config/provider/gemini/models"),
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    retryGeneration.resolve(
      okResponse({
        google: {
          id: "google",
          name: "Google",
          models: {
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

    const retryResponses = await Promise.all(retryRequests);
    const retryBodies = await Promise.all(
      retryResponses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      })),
    );
    expect(retryBodies.every(({ status }) => status === 200)).toBe(true);
    expect(retryBodies.every(({ body }) => (body as { source: string }).source === "live")).toBe(
      true,
    );
    expect(new Set(retryBodies.map(({ body }) => JSON.stringify(body))).size).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("GET /config/provider/openrouter/models", () => {
  const liveModelsResponse = () =>
    new Response(
      JSON.stringify({
        data: [
          {
            id: "openai/test-model",
            name: "Test Model",
            context_length: 4096,
            supported_parameters: ["response_format"],
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  it("rejects a hostile Origin before an authenticated upstream fetch in tokenless development", async () => {
    await saveOpenRouterCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(liveModelsResponse());
    const app = await loadApp();

    const response = await app.request("/api/config/provider/openrouter/models", {
      headers: { Host: "localhost:3000", Origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a localhost Origin to perform the authenticated upstream fetch", async () => {
    await saveOpenRouterCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(liveModelsResponse());
    const app = await loadApp();

    const response = await app.request("/api/config/provider/openrouter/models", {
      headers: { Host: "localhost:3000", Origin: "http://localhost:5173" },
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      expect.objectContaining({ headers: { Authorization: "Bearer sk-test" } }),
    );
  });

  it("allows an authenticated non-browser client to perform the upstream fetch", async () => {
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "server-token";
    await saveOpenRouterCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(liveModelsResponse());
    const app = await loadApp();

    const response = await app.request("/api/config/provider/openrouter/models", {
      headers: {
        Host: "localhost:3000",
        Origin: "https://client.example",
        [SHUTDOWN_TOKEN_HEADER]: "server-token",
      },
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("does not forward a foreign env secret loaded from disk", async () => {
    const foreignEnvName = "UNRELATED_PROCESS_SECRET";
    const originalForeignSecret = process.env[foreignEnvName];
    process.env[foreignEnvName] = "must-not-forward";

    try {
      writeFileSync(
        join(diffgazerHome, "config.json"),
        `${JSON.stringify({
          settings: { secretsStorage: "file" },
          providers: [
            {
              provider: "openrouter",
              hasApiKey: true,
              isActive: true,
              model: "openrouter/auto",
            },
          ],
        })}\n`,
      );
      writeFileSync(
        join(diffgazerHome, "secrets.json"),
        `${JSON.stringify({
          providers: {
            openrouter: { kind: "env", varName: foreignEnvName },
          },
        })}\n`,
      );
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(liveModelsResponse());
      const app = await loadRouter();

      const response = await app.request("/config/provider/openrouter/models");

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "API_KEY_MISSING" },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (originalForeignSecret === undefined) delete process.env[foreignEnvName];
      else process.env[foreignEnvName] = originalForeignSecret;
    }
  });

  it("coalesces concurrent authenticated fetches and retries after a failed generation", async () => {
    await saveOpenRouterCredentials();

    const failedGeneration = createDeferred<Response>();
    const retryGeneration = createDeferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(failedGeneration.promise)
      .mockReturnValueOnce(retryGeneration.promise);
    const app = await loadRouter();

    const failedRequests = Array.from({ length: 8 }, () =>
      app.request("/config/provider/openrouter/models"),
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    failedGeneration.reject(new Error("network down"));

    const failedResponses = await Promise.all(failedRequests);
    const failedBodies = await Promise.all(
      failedResponses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      })),
    );
    expect(failedBodies.every(({ status }) => status === 500)).toBe(true);
    expect(new Set(failedBodies.map(({ body }) => JSON.stringify(body))).size).toBe(1);

    const retryRequests = Array.from({ length: 8 }, () =>
      app.request("/config/provider/openrouter/models"),
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    retryGeneration.resolve(
      okResponse({
        data: [
          {
            id: "openai/test-model",
            name: "Test Model",
            context_length: 4096,
            supported_parameters: ["response_format"],
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
    );

    const retryResponses = await Promise.all(retryRequests);
    const retryBodies = await Promise.all(
      retryResponses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      })),
    );
    expect(retryBodies.every(({ status }) => status === 200)).toBe(true);
    expect(new Set(retryBodies.map(({ body }) => JSON.stringify(body))).size).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
