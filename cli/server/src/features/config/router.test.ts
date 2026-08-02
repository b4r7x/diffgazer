import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import {
  ClientConfigurationActionResponseSchema,
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
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

const removedRecord = () => ({
  schemaVersion: 2,
  status: "removed",
  configurationId: "cfg-removed",
  revision: 1,
  productId: REMOVED_PRODUCT_ID,
  transportFamily: "hosted-api",
  selectedModelId: null,
  acknowledgement: null,
  evidenceReference: null,
  budget: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

async function loadRouter() {
  const { configRouter } = await import("./router.js");
  // Deletion fails closed without a lease authority, so the router test installs
  // the same process-wide one the composition root installs.
  const { setConfigurationLeaseHooks } = await import("./service.js");
  const { createConfigurationLeaseHooks } = await import("../../shared/lib/session-registry.js");
  setConfigurationLeaseHooks(createConfigurationLeaseHooks());
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

describe("POST /config/actions removed rejection", () => {
  it("rejects update actions against removed configurations", async () => {
    const app = await loadRouter();
    await grantProjectTrust();
    const secretPath = join(diffgazerHome, "credentials", "cfg-removed-1.key");
    writeFileSync(
      join(diffgazerHome, "config.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        settings: {},
        selectedConfigurationId: null,
        configurations: [removedRecord()],
      })}\n`,
    );
    writeFileSync(
      join(diffgazerHome, "secrets.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        bindings: [
          {
            configurationId: "cfg-removed",
            revision: 1,
            kind: "file-0600",
            filePath: secretPath,
            status: "removed",
          },
        ],
      })}\n`,
    );
    mkdirSync(dirname(secretPath), { recursive: true });
    writeFileSync(secretPath, "sk-zai-coding-secret", { mode: 0o600 });

    const response = await postConfigurationAction(app, updateGeminiAction("cfg-removed", 1));

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
