import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { dirname, join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { executionLimitsFromBudget } from "../ai/admission/service.js";
import { createAdmissionEvidence } from "./admission-evidence.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "./store.js";
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
const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const LM_STUDIO_ENDPOINT = "http://127.0.0.1:1234/v1";
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
  acknowledgement: { noticeVersion: 1, acceptedAt: null },
  evidenceReference: null,
  budget: DEFAULT_BUDGET,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

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
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
});

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
  runtime: { identity: "diffgazer-server", version: "1.0.0" },
  structuredOutputSchemaSha256: "1".repeat(64),
  noticeVersion: 1,
  limits: executionLimitsFromBudget(DEFAULT_CONFIGURATION_BUDGET),
});

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

  it("inspects a supported configuration and reports removed records as removed", async () => {
    writeJson(configPath(), v2Config([supportedRecord(), removedRecord()]));
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

    const removed = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-removed",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value).toMatchObject({
      action: "inspect",
      status: "succeeded",
      configuration: {
        configurationId: "cfg-removed",
        status: "removed",
        productId: REMOVED_PRODUCT_ID,
        availableActions: ["inspect", "delete"],
      },
      readiness: { status: "removed" },
    });

    const missing = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-never-created",
    });
    expect(missing).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });
  });

  it("selects an exact model and marks the configuration as selected", async () => {
    writeJson(configPath(), v2Config([supportedRecord()]));
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

  it("tests without registered evidence report skipped, never passed", async () => {
    writeJson(configPath(), v2Config([supportedRecord({ selectedModelId: "gemini-2.5-flash" })]));
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
      status: "succeeded",
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

  it("creates local-http and local-cli configurations with family-specific bindings", async () => {
    const store = await loadStore();

    const ollama = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "local-http",
        productId: "ollama",
        endpoint: OLLAMA_ENDPOINT,
        authentication: "none",
      },
    });
    expect(ollama.ok).toBe(true);
    if (!ollama.ok) return;
    expect(ollama.value.configuration).toMatchObject({
      status: "supported",
      transportFamily: "local-http",
      productId: "ollama",
      authentication: "none",
    });

    const localOpenAi = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: LM_STUDIO_ENDPOINT,
        authentication: "optional-local-bearer",
        presetId: "lm-studio",
        bearerToken: { kind: "literal", value: "lm-studio-bearer-token" },
      },
    });
    expect(localOpenAi.ok).toBe(true);
    if (!localOpenAi.ok) return;
    const secrets = readJson<{ bindings: Array<{ kind: string }> }>(secretsPath());
    expect(secrets.bindings.some((binding) => binding.kind === "optional-local-bearer")).toBe(true);

    const codex = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "local-cli",
        productId: "codex-cli",
        installationId: "codex-installation-1",
      },
    });
    expect(codex.ok).toBe(true);
    if (!codex.ok) return;
    expect(codex.value.configuration).toMatchObject({
      status: "supported",
      transportFamily: "local-cli",
      productId: "codex-cli",
      installationId: "codex-installation-1",
    });
  });

  it("rejects update, select, and test on removed configurations but allows delete", async () => {
    writeJson(configPath(), v2Config([removedRecord()]));
    const store = await loadStore();

    const update = await store.runConfigurationAction(updateGeminiAction("cfg-removed", 1));
    expect(update).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    const select = await store.runConfigurationAction({
      action: "select",
      configurationId: "cfg-removed",
      modelId: "gemini-2.5-flash",
    });
    expect(select).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    const test = await store.runConfigurationAction({
      action: "test",
      configurationId: "cfg-removed",
    });
    expect(test).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-removed",
      expectedRevision: 1,
    });
    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
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

    const qwen = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "qwen",
        endpoint: QWEN_ENDPOINT,
        region: "international",
        workspace: "workspace-alpha",
        credential: { kind: "literal", value: "sk-proj-qwen-literal-secret" },
      },
    });
    expect(qwen.ok).toBe(true);
    if (!qwen.ok) return;
    responses.push(qwen.value);

    const serialized = JSON.stringify(responses);
    expect(serialized).not.toContain("sk-proj-hosted-literal-secret");
    expect(serialized).not.toContain("sk-proj-qwen-literal-secret");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain("QWEN_API_KEY");
    expect(serialized).not.toContain("credentials/");
    expect(serialized).not.toContain("file-0600");
    expect(serialized).not.toContain("keyId");
    expect(serialized).not.toContain("credentialReferenceIdentity");
    expect(serialized).not.toContain("structuredOutputSchemaSha256");
    expect(serialized).not.toContain("evidenceReference");

    const configText = readFileSync(configPath(), "utf8");
    expect(configText).not.toContain("sk-proj-hosted-literal-secret");
    expect(configText).not.toContain("sk-proj-qwen-literal-secret");
    expect(configText).not.toContain("GOOGLE_API_KEY");
  });

  it("rejects a secret-like workspace before any state is persisted", async () => {
    const store = await loadStore();

    const result = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: "qwen",
        endpoint: QWEN_ENDPOINT,
        region: "international",
        workspace: "sk-proj-workspace-secret",
        credential: { kind: "literal", value: "sk-proj-workspace-test" },
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    expect(existsSync(configPath())).toBe(false);
    expect(existsSync(secretsPath())).toBe(false);
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

  it("reports ready only after exact-tuple evidence is registered", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-evidence-key" }),
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
        evidenceKey: evidenceKeyFor(configurationId),
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );
    expect(recorded).toEqual({ ok: true, value: true });

    const tested = await store.runConfigurationAction({ action: "test", configurationId });
    expect(tested.ok).toBe(true);
    if (!tested.ok) return;
    expect(tested.value.readiness).toMatchObject({ status: "ready", ready: true });
  });

  it("invalidates registered evidence when the selected model changes", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-evidence-key" }),
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
    await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: evidenceKeyFor(configurationId),
        checkedAt: "2026-01-02T00:00:00.000Z",
        status: "passed",
      }),
    );

    const reselected = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-pro",
    });
    expect(reselected.ok).toBe(true);
    if (!reselected.ok) return;

    const inspected = await store.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.value.readiness).toMatchObject({ status: "conformance-pending" });
  });

  it("rejects evidence that does not match the exact configuration tuple", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-evidence-key" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const result = await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: { ...evidenceKeyFor(configurationId), modelId: "gemini-2.5-pro" },
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

  it("binds an environment bearer reference for optional local bearer authentication", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "keyring" }));
    const store = await loadStore();

    const result = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: LM_STUDIO_ENDPOINT,
        authentication: "optional-local-bearer",
        presetId: "lm-studio",
        bearerToken: { kind: "environment" },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const secrets = readJson<{ bindings: Array<{ kind: string; storage: string }> }>(secretsPath());
    expect(secrets.bindings[0]).toMatchObject({
      kind: "optional-local-bearer",
      storage: "environment-reference",
    });
  });
});
