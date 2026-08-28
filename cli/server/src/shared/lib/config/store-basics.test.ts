import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import type { Result } from "@diffgazer/core/result";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../ai/admission/protocol.js";
import { buildExpectedEvidenceKey, createAdmissionEvidence } from "./admission-evidence.js";
import { executionLimitsFromBudget } from "./budget-ceiling.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  keyring,
  loadStore,
  loadStoreFactory,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4";
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

const seedSupportedBinding = () =>
  v2Secrets([
    {
      configurationId: "cfg-existing",
      revision: 1,
      kind: "file-0600",
      filePath: join(diffgazerHome, "credentials", "cfg-existing-1.key"),
      status: "active",
    },
  ]);

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

const GEMINI_ACKNOWLEDGEMENT = {
  status: "accepted",
  noticeId: "gemini-hosted-api",
  noticeVersion: 1,
  acceptedAt: "2026-01-02T00:00:00.000Z",
} as const;

// A record whose notice is accepted, so readiness reports the tuple rather than
// the outstanding acknowledgement.
const acknowledgedRecord = (overrides: Record<string, unknown> = {}) =>
  supportedRecord({
    acknowledgement: {
      noticeId: GEMINI_ACKNOWLEDGEMENT.noticeId,
      noticeVersion: GEMINI_ACKNOWLEDGEMENT.noticeVersion,
      acceptedAt: GEMINI_ACKNOWLEDGEMENT.acceptedAt,
    },
    ...overrides,
  });

const createGeminiAction = (
  credential: { kind: "literal"; value: string } | { kind: "environment" },
  options?: { acknowledgement: typeof GEMINI_ACKNOWLEDGEMENT },
) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential,
    },
    ...(options?.acknowledgement ? { acknowledgement: options.acknowledgement } : {}),
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
  limits: executionLimitsFromBudget(DEFAULT_BUDGET),
});

const evidenceKeyForPersisted = (configurationId: string): EvidenceKey => {
  const config = readJson<{
    configurations: Array<SupportedProviderConfigurationRecord>;
  }>(configPath());
  const record = config.configurations.find((entry) => entry.configurationId === configurationId);
  if (!record) throw new Error("configuration not found in persisted config");
  const secrets = readJson<{
    bindings: Array<{
      configurationId: string;
      revision: number;
      kind: string;
      filePath?: string;
      status: string;
    }>;
  }>(secretsPath());
  const binding = secrets.bindings.find(
    (entry) =>
      entry.configurationId === configurationId &&
      entry.status === "active" &&
      entry.revision === record.revision,
  );
  return buildExpectedEvidenceKey({
    record,
    runtime: RUNTIME_IDENTITY,
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    credentialReferenceIdentity:
      binding?.kind === "file-0600" && binding.filePath
        ? sha256CanonicalJsonSync({ kind: "file-0600", filePath: binding.filePath })
        : null,
  });
};

const succeed = <T>(result: Result<T, unknown>): T => {
  if (!result.ok) throw new Error("expected a succeeded configuration action");
  return result.value;
};

describe("config store actions", () => {
  it("creates a hosted-api configuration and its secret binding atomically", async () => {
    const store = await loadStore();

    const result = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-test-secret-12345" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.action).toBe("create");
    expect(result.value.status).toBe("succeeded");
    const configuration = result.value.configuration;
    expect(configuration).toMatchObject({
      status: "supported",
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      selectedModelId: null,
      revision: 1,
      availableActions: ["inspect", "select", "test", "update", "delete"],
    });
    if (!configuration) throw new Error("create response requires a configuration");

    const persisted = readJson<{
      schemaVersion: number;
      configurations: Array<{ configurationId: string }>;
    }>(configPath());
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.configurations).toHaveLength(1);
    expect(persisted.configurations[0]?.configurationId).toBe(configuration.configurationId);

    const secrets = readJson<{ schemaVersion: number; bindings: Array<{ kind: string }> }>(
      secretsPath(),
    );
    expect(secrets.schemaVersion).toBe(2);
    expect(secrets.bindings).toHaveLength(1);
    expect(secrets.bindings[0]?.kind).toBe("file-0600");
    expect(existsSync(literalSecretPathFor(configuration.configurationId, 1))).toBe(true);
  });

  it("creates an environment-reference binding without storing a literal", async () => {
    const store = await loadStore();

    const result = await store.runConfigurationAction(createGeminiAction({ kind: "environment" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const configuration = result.value.configuration;
    if (!configuration) throw new Error("create response requires a configuration");

    const secrets = readJson<{
      bindings: Array<{ kind: string; varName?: string }>;
    }>(secretsPath());
    expect(secrets.bindings[0]).toMatchObject({ kind: "environment-reference" });
    expect(existsSync(literalSecretPathFor(configuration.configurationId, 1))).toBe(false);
  });

  it("creates a configuration when the existing config predates acknowledgement notice ids", async () => {
    writeJson(
      configPath(),
      v2Config(
        [
          supportedRecord({
            configurationId: "cfg-v1-zai",
            productId: "zai",
            input: {
              transportFamily: "hosted-api",
              productId: "zai",
              endpoint: "https://api.z.ai/api/paas/v4",
            },
            acknowledgement: { noticeVersion: 1, acceptedAt: null },
          }),
        ],
        "cfg-v1-zai",
      ),
    );
    writeJson(secretsPath(), v2Secrets());
    const store = await loadStore();

    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-test-secret-12345" }),
    );
    expect(created.ok).toBe(true);

    const snapshot = await store.readConfigurationSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.selectedConfigurationId).toBe("cfg-v1-zai");
    expect(
      snapshot.value.configurations.map((entry) => entry.configuration.configurationId),
    ).toContain("cfg-v1-zai");
  });

  it("inspects a supported configuration and reports a missing one as not found", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const store = await loadStore();

    const supported = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-existing",
    });
    expect(supported.ok).toBe(true);
    if (!supported.ok) return;
    expect(supported.value).toMatchObject({
      action: "inspect",
      status: "succeeded",
      configuration: { configurationId: "cfg-existing", revision: 1, status: "supported" },
    });

    const missing = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-never-created",
    });
    expect(missing).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });
  });

  it("selects an exact model and marks the configuration as selected", async () => {
    writeJson(configPath(), v2Config([acknowledgedRecord()]));
    writeJson(secretsPath(), seedSupportedBinding());
    const store = await loadStore();

    const result = await store.runConfigurationAction({
      action: "select",
      configurationId: "cfg-existing",
      modelId: "gemini-2.5-flash",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      action: "select",
      status: "succeeded",
      configuration: { selectedModelId: "gemini-2.5-flash" },
      readiness: { status: "conformance-pending" },
    });
    const persisted = readJson<{ selectedConfigurationId: string | null }>(configPath());
    expect(persisted.selectedConfigurationId).toBe("cfg-existing");
  });

  it("tests without registered evidence report a failed test with skipped readiness, never passed", async () => {
    writeJson(
      configPath(),
      v2Config([acknowledgedRecord({ selectedModelId: "gemini-2.5-flash" })]),
    );
    writeJson(secretsPath(), seedSupportedBinding());
    const store = await loadStore();

    const result = await store.runConfigurationAction({
      action: "test",
      configurationId: "cfg-existing",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      action: "test",
      status: "failed",
      readiness: { status: "skipped", evidenceStatus: "skipped", ready: false },
    });
  });

  it("updates a configuration revision and the notice acknowledgement atomically", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const store = await loadStore();

    const result = await store.runConfigurationAction(updateGeminiAction("cfg-existing", 1));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      action: "update",
      status: "succeeded",
      configuration: { configurationId: "cfg-existing", revision: 2 },
    });
    const persisted = readJson<{ configurations: Array<{ revision: number }> }>(configPath());
    expect(persisted.configurations[0]?.revision).toBe(2);
  });

  it("rejects a stale expected revision on update without changing the record", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const store = await loadStore();

    const first = await store.runConfigurationAction(updateGeminiAction("cfg-existing", 1));
    expect(first.ok).toBe(true);

    const stale = await store.runConfigurationAction(updateGeminiAction("cfg-existing", 1));

    expect(stale).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    const persisted = readJson<{ configurations: Array<{ revision: number }> }>(configPath());
    expect(persisted.configurations[0]?.revision).toBe(2);
  });

  it("rejects a stale expected revision on delete and keeps the record", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    const store = await loadStore();

    const result = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
      expectedRevision: 99,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    const persisted = readJson<{ configurations: Array<{ configurationId: string }> }>(
      configPath(),
    );
    expect(persisted.configurations).toHaveLength(1);
    expect(persisted.configurations[0]?.configurationId).toBe("cfg-existing");
  });

  it("deletes a configuration and its credentials without leaving cached state", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-delete-me" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(true);

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.value).toMatchObject({ action: "delete", status: "succeeded" });

    const inspected = await store.runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });
    const persisted = readJson<{ configurations: unknown[] }>(configPath());
    expect(persisted.configurations).toHaveLength(0);
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(false);

    const createStore = await loadStoreFactory();
    const freshStore = createStore();
    const reInspected = await freshStore.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(reInspected).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });
  });

  it("preserves unknown future record bytes and relative order through unrelated updates", async () => {
    const unknownRecord =
      '{"schemaVersion":99,"configurationId":"cfg-future","futureField":{"nested":true},"oddValue":"\\u0041"}';
    const recordA = JSON.stringify(supportedRecord({ configurationId: "cfg-a" }));
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${recordA},${unknownRecord}]}\n`,
    );
    const store = await loadStore();

    await store.runConfigurationAction(updateGeminiAction("cfg-a", 1));
    await store.runConfigurationAction(createGeminiAction({ kind: "literal", value: "new-key" }));
    await store.runConfigurationAction(updateGeminiAction("cfg-a", 2));

    const text = readFileSync(configPath(), "utf8");
    expect(text).toContain(unknownRecord);
    const parsed = readJson<{
      configurations: Array<{ configurationId: string }>;
    }>(configPath());
    expect(parsed.configurations.map((record) => record.configurationId)).toEqual([
      "cfg-a",
      "cfg-future",
      expect.stringMatching(/^cfg-/),
    ]);
  });

  it("keeps a config whose selected configuration names a removed product readable as an unknown row", async () => {
    // A user who last ran a build that still shipped groq: the record is
    // schema-valid V2 bytes whose productId this build no longer supports.
    const removedProductRecord = supportedRecord({
      configurationId: "cfg-groq",
      productId: "groq",
      input: {
        transportFamily: "hosted-api",
        productId: "groq",
        endpoint: "https://api.groq.com/openai/v1",
      },
      acknowledgement: {
        noticeId: "groq-hosted-api",
        noticeVersion: 1,
        acceptedAt: CREATED_AT,
      },
    });
    writeJson(configPath(), v2Config([supportedRecord(), removedProductRecord], "cfg-groq"));
    writeJson(secretsPath(), v2Secrets());
    const store = await loadStore();

    const snapshot = await store.readConfigurationSnapshot();
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.selectedConfigurationId).toBe("cfg-groq");
    expect(snapshot.value.unrecognizedConfigurations).toEqual([{ configurationId: "cfg-groq" }]);
    expect(
      snapshot.value.configurations.map((entry) => entry.configuration.configurationId),
    ).toEqual(["cfg-existing"]);

    // The retired record answers CONFIGURATION_UNSUPPORTED instead of crashing…
    const inspected = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-groq",
    });
    expect(inspected).toMatchObject({
      ok: false,
      error: { code: "CONFIGURATION_UNSUPPORTED" },
    });

    // …its exact bytes stay on disk until the user removes it…
    const persistedBefore = readJson<{ configurations: Array<{ productId?: string }> }>(
      configPath(),
    );
    expect(persistedBefore.configurations.map((record) => record.productId)).toEqual([
      "gemini",
      "groq",
    ]);

    // …and removal needs no revision match, because no build can describe one.
    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-groq",
      expectedRevision: 1,
    });
    expect(deleted.ok).toBe(true);
    const persistedAfter = readJson<{ configurations: Array<{ productId?: string }> }>(
      configPath(),
    );
    expect(persistedAfter.configurations.map((record) => record.productId)).toEqual(["gemini"]);
  });

  it("serializes no secret values, environment names, paths, or evidence in responses", async () => {
    const store = await loadStore();
    const responses: unknown[] = [];

    const hosted = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-hosted-literal-secret" }),
    );
    expect(hosted.ok).toBe(true);
    if (!hosted.ok) return;
    responses.push(hosted.value);
    const configurationId = hosted.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    responses.push(
      succeed(
        await store.runConfigurationAction({
          action: "select",
          configurationId,
          modelId: "gemini-2.5-flash",
        }),
      ),
    );
    responses.push(
      succeed(await store.runConfigurationAction({ action: "test", configurationId })),
    );
    responses.push(
      succeed(await store.runConfigurationAction(updateGeminiAction(configurationId, 1))),
    );
    responses.push(
      succeed(
        await store.runConfigurationAction({
          action: "delete",
          configurationId,
          expectedRevision: 2,
        }),
      ),
    );

    const env = await store.runConfigurationAction(createGeminiAction({ kind: "environment" }));
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    responses.push(env.value);

    const zai = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "zai",
        endpoint: ZAI_ENDPOINT,
        credential: { kind: "literal", value: "sk-proj-zai-literal-secret" },
      },
    });
    expect(zai.ok).toBe(true);
    if (!zai.ok) return;
    responses.push(zai.value);

    const serialized = JSON.stringify(responses);
    expect(serialized).not.toContain("sk-proj-hosted-literal-secret");
    expect(serialized).not.toContain("sk-proj-zai-literal-secret");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain("ZAI_API_KEY");
    expect(serialized).not.toContain("credentials/");
    expect(serialized).not.toContain("file-0600");
    expect(serialized).not.toContain("keyId");
    expect(serialized).not.toContain("credentialReferenceIdentity");
    expect(serialized).not.toContain("structuredOutputSchemaSha256");
    expect(serialized).not.toContain("evidenceReference");

    const configText = readFileSync(configPath(), "utf8");
    expect(configText).not.toContain("sk-proj-hosted-literal-secret");
    expect(configText).not.toContain("sk-proj-zai-literal-secret");
    expect(configText).not.toContain("GOOGLE_API_KEY");
  });

  it("rolls back a failed create without partial records or bindings", async () => {
    const store = await loadStore();
    writeFileSync(join(diffgazerHome, "credentials"), "not a directory");
    const before = existsSync(configPath()) ? readFileSync(configPath(), "utf8") : null;
    const secretsBefore = existsSync(secretsPath()) ? readFileSync(secretsPath(), "utf8") : null;

    const result = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-never-persisted" }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "SECRET_BINDING_FAILED" } });
    const after = existsSync(configPath()) ? readFileSync(configPath(), "utf8") : null;
    const secretsAfter = existsSync(secretsPath()) ? readFileSync(secretsPath(), "utf8") : null;
    expect(after).toBe(before);
    expect(secretsAfter).toBe(secretsBefore);
  });

  it("persists create acknowledgement so probe readiness is not acknowledgement-required", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction(
        { kind: "literal", value: "sk-proj-create-ack" },
        { acknowledgement: GEMINI_ACKNOWLEDGEMENT },
      ),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    const persisted = readJson<{
      configurations: Array<{ acknowledgement: { acceptedAt: string | null } }>;
    }>(configPath());
    expect(persisted.configurations[0]?.acknowledgement.acceptedAt).not.toBeNull();

    await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: evidenceKeyForPersisted(configurationId),
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );

    const inspected = await store.runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.value.readiness).toMatchObject({ status: "ready", ready: true });
    expect(inspected.value.readiness?.status).not.toBe("acknowledgement-required");
  });

  it("reports ready only after exact-tuple evidence is registered", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction(
        { kind: "literal", value: "sk-proj-evidence-key" },
        { acknowledgement: GEMINI_ACKNOWLEDGEMENT },
      ),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    await store.runConfigurationAction(updateGeminiAction(configurationId, 1));

    const recorded = await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: evidenceKeyForPersisted(configurationId),
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );
    expect(recorded).toEqual({ ok: true, value: true });

    const inspected = await store.runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.value.readiness).toMatchObject({ status: "ready", ready: true });
  });

  it("rejects evidence that does not match the exact configuration tuple", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
    writeJson(secretsPath(), seedSupportedBinding());
    const store = await loadStore();

    const result = await store.recordConfigurationEvidence(
      "cfg-existing",
      createAdmissionEvidence({
        evidenceKey: { ...evidenceKeyFor("cfg-existing"), modelId: "gemini-2.5-pro" },
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    const persisted = readJson<{ configurations: Array<{ evidenceReference: string | null }> }>(
      configPath(),
    );
    expect(persisted.configurations[0]?.evidenceReference).toBeNull();
  });

  it("uses keyring storage for literal secrets when keyring mode is selected", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "keyring" }));
    const store = await loadStore();

    const result = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-keyring-secret" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith(
      expect.stringMatching(/^secret_binding_cfg-/),
      "sk-proj-keyring-secret",
    );
    const secrets = readJson<{ bindings: Array<{ kind: string }> }>(secretsPath());
    expect(secrets.bindings[0]?.kind).toBe("keyring-reference");
  });

  it("keeps the config file byte-identical when a failed delete rolls back", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-rollback-key" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    const before = readFileSync(configPath(), "utf8");
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error("Injected secrets removal failure");
      return false;
    };

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });

    expect(deleted).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(configPath(), "utf8")).toBe(before);
    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(true);
    expect(readFileSync(literalSecretPathFor(configurationId, 1), "utf8")).toBe(
      "sk-proj-rollback-key",
    );
    const inspected = await store.runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });

  it("keeps keyring secret material when a failed delete rolls back", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "keyring" }));
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-rollback-keyring" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    keyring.deleteKeyringSecret.mockClear();
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error("Injected secrets removal failure");
      return false;
    };

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });

    expect(deleted).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    const inspected = await store.runConfigurationAction({ action: "inspect", configurationId });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });
});
