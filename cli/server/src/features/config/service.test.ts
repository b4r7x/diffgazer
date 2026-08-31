import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RUNTIME_IDENTITY,
  STRUCTURED_OUTPUT_SCHEMA_SHA256,
} from "../../shared/lib/ai/admission/protocol.js";
import { createAdmissionEvidence } from "../../shared/lib/config/admission-evidence.js";
import { executionLimitsFromBudget } from "../../shared/lib/config/budget-ceiling.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "../../shared/lib/config/store.js";
import {
  catalog,
  configPath,
  diffgazerHome,
  loadStore,
  secretsPath,
  writeJson,
} from "../../shared/lib/config/store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

const DEFAULT_BUDGET = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const v2Config = (
  records: unknown[],
  selectedConfigurationId: string | null = null,
  settings: Record<string, unknown> = {},
) => ({
  schemaVersion: 2,
  settings,
  selectedConfigurationId,
  configurations: records,
});

const v2Secrets = (bindings: unknown[] = []) => ({ schemaVersion: 2, bindings });

const supportedRecord = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  status: "supported",
  configurationId: "cfg-existing",
  revision: 1,
  transportFamily: "hosted-api",
  productId: "gemini",
  input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
  selectedModelId: null,
  acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
  evidenceReference: null,
  budget: DEFAULT_BUDGET,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const unknownRecord = () => ({ schemaVersion: 99, configurationId: "cfg-future" });

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

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const evidenceKeyFor = (configurationId: string): EvidenceKey => ({
  authentication: null,
  credentialReferenceIdentity: sha256CanonicalJsonSync({
    kind: "file-0600",
    filePath: literalSecretPathFor(configurationId, 1),
  }),
  installationId: null,
  productId: "gemini",
  transportFamily: "hosted-api",
  normalizedEndpoint: GEMINI_ENDPOINT,
  region: null,
  workspaceAccountReference: null,
  modelId: "gemini-2.5-flash",
  runtime: RUNTIME_IDENTITY,
  structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
  noticeVersion: 1,
  limits: executionLimitsFromBudget(DEFAULT_CONFIGURATION_BUDGET),
});

async function loadService() {
  return import("./service.js");
}

// Deletion fails closed without a lease authority, so these tests install the
// same process-wide one the composition root installs.
async function installLeaseAuthority(): Promise<void> {
  const { registerConfigSeams } = await import("../../shared/lib/config/seams.js");
  const { createConfigurationLeaseHooks } = await import("../../shared/lib/session-registry.js");
  registerConfigSeams({ leaseHooks: createConfigurationLeaseHooks() });
}

// `loadStore` reinstalls the real authority, so a test that wants to observe the
// hook calls installs its own recorder after the store is loaded.
async function recordLeaseHookCalls(): Promise<string[]> {
  const { registerConfigSeams } = await import("../../shared/lib/config/seams.js");
  const events: string[] = [];
  registerConfigSeams({
    leaseHooks: {
      revoke: (configurationId) => {
        events.push(`revoke:${configurationId}`);
      },
      cancel: (configurationId) => {
        events.push(`cancel:${configurationId}`);
      },
      drain: (configurationId) => {
        events.push(`drain:${configurationId}`);
      },
      clearRevocation: (configurationId) => {
        events.push(`clearRevocation:${configurationId}`);
      },
    },
  });
  return events;
}

async function seedGeminiConfiguration() {
  const { runConfigurationAction } = await loadService();
  await loadStore();
  const created = await runConfigurationAction(
    createGeminiAction({ kind: "literal", value: "sk-proj-service-secret" }),
  );
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("expected gemini configuration to be created");
  const configurationId = created.value.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");
  return { runConfigurationAction, configurationId };
}

describe("configuration service actions", () => {
  beforeEach(async () => {
    await installLeaseAuthority();
  });

  it("executes all six configuration actions through the store entrypoint", async () => {
    const { runConfigurationAction } = await loadService();
    const created = await runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-six-actions" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value).toMatchObject({ action: "create", status: "succeeded" });
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const inspected = await runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected).toMatchObject({
      ok: true,
      value: { action: "inspect", status: "succeeded" },
    });

    const selected = await runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    expect(selected).toMatchObject({ ok: true, value: { action: "select", status: "succeeded" } });

    const tested = await runConfigurationAction({ action: "test", configurationId });
    // The seam-default probe observes nothing and records no evidence, so the
    // action executes (ok) but must not report a succeeded test.
    expect(tested).toMatchObject({ ok: true, value: { action: "test", status: "failed" } });

    const updated = await runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(updated).toMatchObject({ ok: true, value: { action: "update", status: "succeeded" } });

    const deleted = await runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 2,
    });
    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
  });

  it("binds discovery to the exact endpoint, product, and model tuple", async () => {
    const { runConfigurationAction } = await loadService();

    const wrongEndpoint = await runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: "https://evil.example.com/v1beta",
        credential: { kind: "literal", value: "sk-proj-wrong-endpoint" },
      },
    });
    expect(wrongEndpoint).toMatchObject({ ok: false, error: { code: "INVALID_ACTION" } });

    const wrongModel = await runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: { kind: "literal", value: "sk-proj-wrong-model" },
      },
    });
    expect(wrongModel.ok).toBe(true);
    if (!wrongModel.ok) return;
    const configurationId = wrongModel.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const selected = await runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini/latest",
    });
    expect(selected).toMatchObject({ ok: false, error: { code: "INVALID_ACTION" } });
  });

  it("serializes no secret material in action responses", async () => {
    const { runConfigurationAction, listConfigurations, getInitState } = await loadService();
    const responses: unknown[] = [];

    const hosted = await runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-hosted-literal-secret" }),
    );
    expect(hosted.ok).toBe(true);
    if (!hosted.ok) return;
    responses.push(hosted.value);
    const configurationId = hosted.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const selected = await runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    expect(selected.ok).toBe(true);
    if (selected.ok) responses.push(selected.value);

    const tested = await runConfigurationAction({ action: "test", configurationId });
    expect(tested.ok).toBe(true);
    if (tested.ok) responses.push(tested.value);

    const updated = await runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(updated.ok).toBe(true);
    if (updated.ok) responses.push(updated.value);

    const listed = await listConfigurations();
    expect(listed.ok).toBe(true);
    if (listed.ok) responses.push(listed.value);

    const initState = await getInitState();
    expect(initState.ok).toBe(true);
    if (initState.ok) responses.push(initState.value);

    const deleted = await runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 2,
    });
    expect(deleted.ok).toBe(true);
    if (deleted.ok) responses.push(deleted.value);

    const serialized = JSON.stringify(responses);
    expect(serialized).not.toContain("sk-proj-hosted-literal-secret");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain("credentials/");
    expect(serialized).not.toContain("file-0600");
    expect(serialized).not.toContain("credentialReferenceIdentity");
  });

  it("requires notice acknowledgement on update", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const { runConfigurationAction } = await loadService();

    const result = await runConfigurationAction({
      action: "update",
      configurationId: "cfg-existing",
      expectedRevision: 1,
      input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
      acknowledgement: {
        status: "accepted",
        noticeId: "wrong-notice",
        noticeVersion: 99,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
  });

  it("reports skipped readiness without fallback when test has no evidence", async () => {
    writeJson(
      configPath(),
      v2Config([
        supportedRecord({
          selectedModelId: "gemini-2.5-flash",
          acknowledgement: {
            noticeId: "gemini-hosted-api",
            noticeVersion: 1,
            acceptedAt: CREATED_AT,
          },
        }),
      ]),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor("cfg-existing", 1),
          status: "active",
        },
      ]),
    );
    const { runConfigurationAction } = await loadService();

    const result = await runConfigurationAction({
      action: "test",
      configurationId: "cfg-existing",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.readiness).toMatchObject({
      status: "skipped",
      evidenceStatus: "skipped",
      ready: false,
    });
  });

  it("rejects a stale expected revision without mutating the record", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const { runConfigurationAction } = await loadService();

    const first = await runConfigurationAction(updateGeminiAction("cfg-existing", 1));
    expect(first.ok).toBe(true);

    const stale = await runConfigurationAction(updateGeminiAction("cfg-existing", 1));
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });

    const persisted = JSON.parse(readFileSync(configPath(), "utf8")) as {
      configurations: Array<{ revision: number }>;
    };
    expect(persisted.configurations[0]?.revision).toBe(2);
  });

  it("rejects a stale expected revision on delete without mutating the record", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const { runConfigurationAction } = await loadService();
    const configBefore = readFileSync(configPath(), "utf8");

    const stale = await runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
      expectedRevision: 99,
    });

    expect(stale).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
  });

  // Clients read the echoed summary instead of re-deriving what they asked for,
  // so a succeeded response must carry the requested model and a revision that
  // has actually moved past the one the caller held.
  it("echoes the requested model on select and a moved revision on update", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const { runConfigurationAction } = await loadService();

    const selected = await runConfigurationAction({
      action: "select",
      configurationId: "cfg-existing",
      modelId: "gemini-2.5-flash",
    });
    expect(selected).toMatchObject({
      ok: true,
      value: {
        action: "select",
        status: "succeeded",
        configuration: { selectedModelId: "gemini-2.5-flash" },
      },
    });

    const updated = await runConfigurationAction(updateGeminiAction("cfg-existing", 1));
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.configuration?.revision).toBeGreaterThan(1);
  });

  it("revokes, cancels, and drains leases before transactional delete", async () => {
    const { runConfigurationAction } = await loadService();
    const { configurationId } = await seedGeminiConfiguration();
    const events = await recordLeaseHookCalls();
    const configBefore = readFileSync(configPath(), "utf8");

    const deleted = await runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });

    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
    expect(events).toEqual([
      `revoke:${configurationId}`,
      `cancel:${configurationId}`,
      `drain:${configurationId}`,
    ]);
    expect(readFileSync(configPath(), "utf8")).not.toBe(configBefore);
    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(false);
  });
});

describe("configuration catalog model discovery", () => {
  const discoveredAt = "2026-08-02T12:00:00.000Z";

  const catalogModel = (id: string, tier: "free" | "paid" = "paid") => ({
    id,
    name: id,
    description: "128K context",
    tier,
  });

  async function seedHostedConfiguration(
    productId: "zai" | "openrouter" = "zai",
    endpoint = "https://api.z.ai/api/paas/v4",
  ) {
    const service = await loadService();
    await loadStore();
    const created = await service.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId,
        endpoint,
        credential: { kind: "literal", value: "sk-hosted-service-secret" },
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(`expected ${productId} configuration to be created`);
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    return { service, configurationId };
  }

  it("returns product-filtered catalog models for a supported configuration", async () => {
    const { service, configurationId } = await seedHostedConfiguration(
      "openrouter",
      "https://openrouter.ai/api/v1",
    );
    catalog.discoverConfigurationCatalog.mockImplementation(
      async (tuple: { configurationId: string; productId: string }) => ({
        ...tuple,
        status: "passed",
        models: [catalogModel("openai/gpt-4.1-mini"), catalogModel("openrouter/auto")],
        fetchedAt: discoveredAt,
        source: "snapshot",
        cached: false,
        checkedAt: discoveredAt,
      }),
    );

    const result = await service.discoverConfigurationModels(configurationId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      status: "passed",
      configurationId,
      productId: "openrouter",
      transportFamily: "hosted-api",
      checkedAt: discoveredAt,
      source: "snapshot",
      cached: false,
    });
    if (result.value.status !== "passed") return;
    expect(result.value.models.map(({ id }) => id)).toEqual(["openai/gpt-4.1-mini"]);
    expect(catalog.discoverConfigurationCatalog).toHaveBeenCalledWith({
      configurationId,
      productId: "openrouter",
      // The bound endpoint travels with the tuple: it keys the live-list cache
      // and names the pool a row has to be servable from.
      endpoint: "https://openrouter.ai/api/v1",
    });
  });

  it("passes the registry-owned skipped reason through verbatim", async () => {
    const { service, configurationId } = await seedHostedConfiguration();
    catalog.discoverConfigurationCatalog.mockImplementation(
      async (tuple: { configurationId: string; productId: string }) => ({
        ...tuple,
        status: "skipped",
        models: [],
        reason:
          "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.",
        checkedAt: discoveredAt,
      }),
    );

    const result = await service.discoverConfigurationModels(configurationId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      status: "skipped",
      configurationId,
      models: [],
      checkedAt: discoveredAt,
      reason:
        "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.",
    });
  });

  it("degrades an invalid discovery payload to a mapped error instead of throwing", async () => {
    const { service, configurationId } = await seedHostedConfiguration();
    catalog.discoverConfigurationCatalog.mockImplementation(
      async (tuple: { configurationId: string; productId: string }) => ({
        ...tuple,
        status: "passed",
        models: [{ ...catalogModel("glm-4.7"), tier: "premium" }],
        fetchedAt: discoveredAt,
        source: "snapshot",
        cached: false,
        checkedAt: discoveredAt,
      }),
    );

    const result = await service.discoverConfigurationModels(configurationId);

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
  });

  it("fails with CONFIGURATION_NOT_FOUND for an unknown configuration", async () => {
    const service = await loadService();
    await loadStore();

    const result = await service.discoverConfigurationModels("cfg-missing");

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });
    expect(catalog.discoverConfigurationCatalog).not.toHaveBeenCalled();
  });

  it("rejects unknown configurations without touching the catalog", async () => {
    writeJson(configPath(), v2Config([unknownRecord()]));
    const service = await loadService();
    await loadStore();

    const result = await service.discoverConfigurationModels("cfg-future");

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    expect(catalog.discoverConfigurationCatalog).not.toHaveBeenCalled();
  });
});

describe("configuration deletion without a registered lease authority", () => {
  it("fails the delete closed and keeps the secret material", async () => {
    const secretPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(configPath(), v2Config([supportedRecord()]));
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: secretPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(secretPath), { recursive: true });
    writeFileSync(secretPath, "sk-proj-unwired");
    const { runConfigurationAction } = await loadService();
    const configBefore = readFileSync(configPath(), "utf8");

    const deleted = await runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
      expectedRevision: 1,
    });

    expect(deleted).toMatchObject({ ok: false, error: { code: "SECRET_BINDING_FAILED" } });
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(existsSync(secretPath)).toBe(true);
  });
});

describe("configuration service bootstrap reads", () => {
  const temporaryProjectRoots: string[] = [];

  function makeTemporaryProject(): string {
    const projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-service-project-"));
    temporaryProjectRoots.push(projectRoot);
    mkdirSync(join(projectRoot, ".git"));
    return projectRoot;
  }

  afterEach(() => {
    for (const projectRoot of temporaryProjectRoots) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
    temporaryProjectRoots.length = 0;
  });

  it("drops a configuration record without a configurationId instead of blanking the list", async () => {
    const unknownWithoutId = '{"schemaVersion":99}';
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${unknownWithoutId}]}\n`,
    );
    const { listConfigurations } = await loadService();

    const result = await listConfigurations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.configurations).toHaveLength(0);
  });

  it("keeps the readable rows when a record in the middle cannot be inspected", async () => {
    const unknownRecord = '{"schemaVersion":99,"configurationId":"cfg-future"}';
    const firstRecord = supportedRecord({ configurationId: "cfg-first" });
    const lastRecord = supportedRecord({ configurationId: "cfg-last" });
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(firstRecord)},${unknownRecord},${JSON.stringify(lastRecord)}]}\n`,
    );
    writeJson(
      secretsPath(),
      v2Secrets(
        ["cfg-first", "cfg-last"].map((configurationId) => ({
          configurationId,
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor(configurationId, 1),
          status: "active",
        })),
      ),
    );
    for (const configurationId of ["cfg-first", "cfg-last"]) {
      mkdirSync(dirname(literalSecretPathFor(configurationId, 1)), { recursive: true });
      writeFileSync(literalSecretPathFor(configurationId, 1), "sk-proj-existing-secret", {
        mode: 0o600,
      });
    }
    const { listConfigurations } = await loadService();

    const result = await listConfigurations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.configurations.map(({ configuration }) => configuration.configurationId),
    ).toEqual(["cfg-first", "cfg-last"]);
  });

  it("returns supported rows in persisted order", async () => {
    const configurationIds = ["cfg-first", "cfg-middle", "cfg-last"];
    writeJson(
      configPath(),
      v2Config(configurationIds.map((configurationId) => supportedRecord({ configurationId }))),
    );
    writeJson(
      secretsPath(),
      v2Secrets(
        configurationIds.map((configurationId) => ({
          configurationId,
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor(configurationId, 1),
          status: "active",
        })),
      ),
    );
    const { listConfigurations } = await loadService();

    const result = await listConfigurations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.configurations.map(({ configuration }) => configuration.configurationId),
    ).toEqual(configurationIds);
  });

  it("lists supported configurations with safe summaries and readiness", async () => {
    const { listConfigurations } = await loadService();
    await seedGeminiConfiguration();

    const result = await listConfigurations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      schemaVersion: 2,
      selectedConfigurationId: null,
    });
    expect(result.value.configurations).toHaveLength(1);
    expect(result.value.configurations[0]?.configuration).toMatchObject({
      status: "supported",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
    });
  });

  it("returns V2 init state with settings and project info", async () => {
    const projectRoot = makeTemporaryProject();
    const { getInitState } = await loadService();
    await seedGeminiConfiguration();

    const result = await getInitState(projectRoot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(2);
    expect(result.value.settings.secretsStorage).toBeNull();
    expect(result.value.project.path).toBe(projectRoot);
    expect(result.value.configurations).toHaveLength(1);
  });

  it("reports ready only after exact-tuple evidence is registered", async () => {
    const { runConfigurationAction } = await loadService();
    const store = await loadStore();
    const { configurationId } = await seedGeminiConfiguration();

    await runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    await runConfigurationAction(updateGeminiAction(configurationId, 1));
    await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: evidenceKeyFor(configurationId),
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );

    const inspected = await runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.value.readiness).toMatchObject({ status: "ready", ready: true });
  });
});
