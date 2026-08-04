import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import type { ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
  ConfigurationModelsResponseSchema,
} from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BODY_LIMIT_KB } from "../../shared/middlewares/body-limit.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

let diffgazerHome: string;
let projectRoot: string;

const createGeminiAction = (
  credential: { kind: "literal"; value: string } | { kind: "environment" },
) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential,
    },
  }) as const;

const updateGeminiAction = (configurationId: string, expectedRevision: number) =>
  ({
    action: "update",
    configurationId,
    expectedRevision,
    input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: "2026-01-02T00:00:00.000Z",
    },
  }) as const;

const unknownRecord = () => ({ schemaVersion: 99, configurationId: "cfg-future" });

async function loadRouter() {
  const { configRouter } = await import("./router.js");
  // Deletion fails closed without a lease authority, so the router test installs
  // the same process-wide one the composition root installs.
  const { registerConfigSeams } = await import("../../shared/lib/config/seams.js");
  const { createConfigurationLeaseHooks } = await import("../../shared/lib/session-registry.js");
  registerConfigSeams({ leaseHooks: createConfigurationLeaseHooks() });
  const app = new Hono();
  app.route("/config", configRouter);
  return app;
}

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

async function postConfigurationAction(
  app: Hono,
  body: unknown,
  options: { trusted?: boolean } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.trusted !== false) {
    headers[PROJECT_ROOT_HEADER] = projectRoot;
  }
  return app.request("/config/actions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function seedGeminiConfiguration(app: Hono): Promise<string> {
  await grantProjectTrust();
  const created = await postConfigurationAction(
    app,
    createGeminiAction({ kind: "literal", value: "sk-proj-router-secret" }),
  );
  expect(created.status).toBe(200);
  const body = ClientConfigurationActionResponseSchema.parse(await created.json());
  expect(body.action).toBe("create");
  const configurationId = body.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");
  return configurationId;
}

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-config-router-"));
  projectRoot = realpathSync.native(mkdtempSync(join(tmpdir(), "dg-config-router-project-")));
  mkdirSync(join(projectRoot, ".git"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  rmSync(diffgazerHome, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("GET /config/init", () => {
  it("returns V2 bootstrap state after awaiting the async service", async () => {
    const app = await loadRouter();
    const response = await app.request("/config/init", {
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });

    expect(response.status).toBe(200);
    const body = ConfigurationInitResponseSchema.parse(await response.json());
    expect(body.schemaVersion).toBe(2);
    expect(body.settings).toBeDefined();
    expect(body.project.path).toBe(projectRoot);
    expect(body.configurations).toEqual([]);
  });

  it("includes created configuration summaries in bootstrap state", async () => {
    const app = await loadRouter();
    await seedGeminiConfiguration(app);

    const response = await app.request("/config/init", {
      headers: { [PROJECT_ROOT_HEADER]: projectRoot },
    });
    expect(response.status).toBe(200);
    const body = ConfigurationInitResponseSchema.parse(await response.json());
    expect(body.configurations).toHaveLength(1);
    expect(body.configurations[0]?.configuration.productId).toBe("gemini");
  });
});

describe("GET /config/providers", () => {
  it("returns the V2 configuration list projection", async () => {
    const app = await loadRouter();
    const response = await app.request("/config/providers");

    expect(response.status).toBe(200);
    const body = ConfigurationListResponseSchema.parse(await response.json());
    expect(body.schemaVersion).toBe(2);
    expect(body.configurations).toEqual([]);
    expect(body.selectedConfigurationId).toBeNull();
  });
});

describe("GET /config/providers/:configurationId/models", () => {
  const catalogResponse = (models: ProviderModelsResponse["models"]): ProviderModelsResponse => ({
    models,
    fetchedAt: "2026-08-02T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  });

  const catalogModel = (id: string) => ({
    id,
    name: id,
    description: "128K context",
    tier: "paid" as const,
  });

  async function spyCatalogModels(models: ProviderModelsResponse["models"]) {
    const catalogModule = await import("../../shared/lib/ai/models-dev-catalog.js");
    return vi
      .spyOn(catalogModule.catalogProviderModels, "get")
      .mockResolvedValue(catalogResponse(models));
  }

  it("returns passed catalog models for a supported configuration", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    const catalogSpy = await spyCatalogModels([
      catalogModel("gemini-2.5-flash"),
      catalogModel("gemini-2.5-pro"),
    ]);

    const response = await app.request(`/config/providers/${configurationId}/models`);

    expect(response.status).toBe(200);
    const body = ConfigurationModelsResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      status: "passed",
      configurationId,
      productId: "gemini",
      transportFamily: "hosted-api",
      source: "snapshot",
      cached: false,
    });
    if (body.status !== "passed") throw new Error("expected a passed models response");
    expect(body.models.map(({ id }) => id)).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
    expect(catalogSpy).toHaveBeenCalledWith("gemini");
  });

  it("keeps the exact /providers list route working next to the models route", async () => {
    const app = await loadRouter();
    await spyCatalogModels([catalogModel("gemini-2.5-flash")]);

    const response = await app.request("/config/providers");

    expect(response.status).toBe(200);
    const body = ConfigurationListResponseSchema.parse(await response.json());
    expect(body.schemaVersion).toBe(2);
  });

  it("passes discovery when the cached catalog carries a zero-limit model", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    // Real cache tier, no catalog spy: models.dev publishes limit 0 for audio
    // models (groq whisper), which used to fail ModelInfo parsing with a 500.
    writeFileSync(
      join(diffgazerHome, "models-dev.json"),
      JSON.stringify({
        catalog: {
          google: {
            id: "google",
            models: {
              "gemini-2.5-flash": {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
                limit: { context: 1048576, output: 65536 },
              },
              "whisper-large-v3": {
                id: "whisper-large-v3",
                name: "Whisper Large V3",
                limit: { context: 0, output: 0 },
              },
            },
          },
        },
        fetchedAt: new Date().toISOString(),
        generationId: randomUUID(),
      }),
    );

    const response = await app.request(`/config/providers/${configurationId}/models`);

    expect(response.status).toBe(200);
    const body = ConfigurationModelsResponseSchema.parse(await response.json());
    expect(body).toMatchObject({ status: "passed", source: "cache", cached: true });
    if (body.status !== "passed") throw new Error("expected a passed models response");
    expect(body.models.map(({ id }) => id)).toEqual(["gemini-2.5-flash", "whisper-large-v3"]);
    const whisper = body.models.find(({ id }) => id === "whisper-large-v3");
    expect(whisper).not.toHaveProperty("contextLength");
    expect(whisper).not.toHaveProperty("maxOutputTokens");
  });

  it("returns a skipped response when the catalog has no models for the product", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    await spyCatalogModels([]);

    const response = await app.request(`/config/providers/${configurationId}/models`);

    expect(response.status).toBe(200);
    const body = ConfigurationModelsResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      status: "skipped",
      configurationId,
      models: [],
      reason: "No catalog models are available for this configuration product.",
    });
  });

  it("returns 404 for an unknown configuration", async () => {
    const app = await loadRouter();

    const response = await app.request("/config/providers/cfg-missing/models");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIGURATION_NOT_FOUND" },
    });
  });

  it("returns 400 for an unknown configuration", async () => {
    const app = await loadRouter();
    writeFileSync(
      join(diffgazerHome, "config.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        settings: {},
        selectedConfigurationId: null,
        configurations: [unknownRecord()],
      })}\n`,
    );

    const response = await app.request("/config/providers/cfg-future/models");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIGURATION_UNSUPPORTED" },
    });
  });

  it("rejects a malformed configurationId before service delegation", async () => {
    const app = await loadRouter();
    const service = await import("./service.js");
    const discoverSpy = vi.spyOn(service, "discoverConfigurationModels");

    const response = await app.request("/config/providers/-invalid/models");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(discoverSpy).not.toHaveBeenCalled();
  });

  it("rate-limits catalog model fetches after 30 requests per minute", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    await spyCatalogModels([catalogModel("gemini-2.5-flash")]);

    for (let request = 0; request < 30; request += 1) {
      const response = await app.request(`/config/providers/${configurationId}/models`);
      expect(response.status).toBe(200);
    }
    const limited = await app.request(`/config/providers/${configurationId}/models`);

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});

describe("POST /config/actions route contract", () => {
  it("rejects closed-union violations before service delegation", async () => {
    const app = await loadRouter();
    await grantProjectTrust();
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");

    const response = await postConfigurationAction(app, { action: "save", provider: "gemini" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("requires repository trust before running configuration actions", async () => {
    const app = await loadRouter();
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");

    const response = await postConfigurationAction(
      app,
      createGeminiAction({ kind: "literal", value: "sk-proj-untrusted" }),
      { trusted: false },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TRUST_REQUIRED" },
    });
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("enforces the body-limit middleware on the actions route", async () => {
    const app = await loadRouter();
    await grantProjectTrust();
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");

    const response = await app.request("/config/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PROJECT_ROOT_HEADER]: projectRoot,
      },
      body: JSON.stringify({
        action: "create",
        input: {
          transportFamily: "hosted-api",
          productId: "gemini",
          endpoint: GEMINI_ENDPOINT,
          credential: { kind: "literal", value: "x".repeat(DEFAULT_BODY_LIMIT_KB * 1024) },
        },
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
    expect(runSpy).not.toHaveBeenCalled();
  });
});

describe("POST /config/actions service delegation", () => {
  it("delegates create, inspect, select, test, update, and delete to runConfigurationAction", async () => {
    const app = await loadRouter();
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");
    const configurationId = await seedGeminiConfiguration(app);

    const actions = [
      { action: "inspect", configurationId },
      { action: "select", configurationId, modelId: "gemini-2.5-flash" },
      { action: "test", configurationId },
      updateGeminiAction(configurationId, 1),
      { action: "delete", configurationId, expectedRevision: 2 },
    ] as const;

    for (const action of actions) {
      const response = await postConfigurationAction(app, action);
      expect(response.status).toBe(200);
      expect(runSpy).toHaveBeenCalledWith(action);
    }

    expect(runSpy).toHaveBeenCalledWith(
      createGeminiAction({ kind: "literal", value: "sk-proj-router-secret" }),
    );
  });
});

describe("POST /config/actions response schemas", () => {
  it("returns a closed safe response schema for every configuration action", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);

    const responses = [
      await postConfigurationAction(
        app,
        createGeminiAction({ kind: "literal", value: "sk-proj-second-create" }),
      ),
      await postConfigurationAction(app, { action: "inspect", configurationId }),
      await postConfigurationAction(app, {
        action: "select",
        configurationId,
        modelId: "gemini-2.5-flash",
      }),
      await postConfigurationAction(app, { action: "test", configurationId }),
      await postConfigurationAction(app, updateGeminiAction(configurationId, 1)),
      await postConfigurationAction(app, {
        action: "delete",
        configurationId,
        expectedRevision: 2,
      }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(ClientConfigurationActionResponseSchema.safeParse(await response.json()).success).toBe(
        true,
      );
    }
  });
});

describe("POST /config/actions protected delete and update", () => {
  it("requires repository trust for update actions", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");

    const response = await postConfigurationAction(app, updateGeminiAction(configurationId, 1), {
      trusted: false,
    });

    expect(response.status).toBe(403);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("requires repository trust for delete actions", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    const service = await import("./service.js");
    const runSpy = vi.spyOn(service, "runConfigurationAction");

    const response = await postConfigurationAction(
      app,
      { action: "delete", configurationId, expectedRevision: 1 },
      { trusted: false },
    );

    expect(response.status).toBe(403);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("rejects stale delete revisions with CONFIGURATION_CONFLICT", async () => {
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);

    const response = await postConfigurationAction(app, {
      action: "delete",
      configurationId,
      expectedRevision: 99,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIGURATION_CONFLICT" },
    });
  });
});

describe("POST /config/actions unknown rejection", () => {
  it("rejects update actions against unknown configurations", async () => {
    const app = await loadRouter();
    await grantProjectTrust();
    writeFileSync(
      join(diffgazerHome, "config.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        settings: {},
        selectedConfigurationId: null,
        configurations: [unknownRecord()],
      })}\n`,
    );

    const response = await postConfigurationAction(app, updateGeminiAction("cfg-future", 1));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CONFIGURATION_UNSUPPORTED" },
    });
  });
});

describe("POST /config/actions no secret JSON", () => {
  it("never returns literal credential material in action responses", async () => {
    const secret = "sk-proj-router-no-secret-json";
    const app = await loadRouter();
    const configurationId = await seedGeminiConfiguration(app);
    const responses = [
      await postConfigurationAction(app, { action: "inspect", configurationId }),
      await postConfigurationAction(app, {
        action: "select",
        configurationId,
        modelId: "gemini-2.5-flash",
      }),
      await postConfigurationAction(app, { action: "test", configurationId }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(200);
      const serialized = JSON.stringify(await response.json());
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toMatch(/"apiKey"\s*:/);
      expect(serialized).not.toMatch(/"credential"\s*:/);
    }
  });
});

describe("legacy config routes are removed", () => {
  it.each([
    ["POST", "/config"],
    ["DELETE", "/config"],
    ["GET", "/config/check"],
    ["GET", "/config/"],
    ["POST", "/config/provider/gemini/activate"],
    ["DELETE", "/config/provider/gemini"],
    ["GET", "/config/provider/gemini/models"],
    ["GET", "/config/provider/openrouter/models"],
  ] as const)("does not serve legacy route %s %s", async (method, path) => {
    const app = await loadRouter();
    const response = await app.request(path, {
      method,
      headers:
        method === "POST"
          ? { "Content-Type": "application/json", [PROJECT_ROOT_HEADER]: projectRoot }
          : { [PROJECT_ROOT_HEADER]: projectRoot },
      body:
        method === "POST"
          ? JSON.stringify({ provider: "gemini", apiKey: "legacy-key" })
          : undefined,
    });

    expect(response.status).toBe(404);
  });
});
