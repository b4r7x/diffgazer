import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  REMOVED_PRODUCT_IDS,
} from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { dirname, join } from "node:path";
import type { ClientConfigurationAction } from "@diffgazer/core/schemas/config";
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
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

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

const evidenceFor = (configurationId: string) =>
  createAdmissionEvidence({
    evidenceKey: {
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
    },
    checkedAt: "2026-01-02T00:00:00.000Z",
    status: "passed",
  });

describe("config store V1 upgrade", () => {
  const v1Config = (
    providers: unknown[],
    settings: Record<string, unknown> = { secretsStorage: "file" },
  ) => ({ settings, providers });

  const v1Gemini = (overrides: Record<string, unknown> = {}) => ({
    provider: "gemini",
    [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,
    isActive: true,
    model: "gemini-2.5-flash",
    ...overrides,
  });

  it("upgrades a file-backed V1 pair to V2 documents and keeps the credential resolvable", async () => {
    writeJson(configPath(), v1Config([v1Gemini()], { theme: "dark", secretsStorage: "file" }));
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    const store = await loadStore();

    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    const persistedConfig = readJson<{
      schemaVersion: number;
      settings: Record<string, unknown>;
      selectedConfigurationId: string | null;
      configurations: Array<{
        status: string;
        configurationId: string;
        productId: string;
        selectedModelId: string | null;
      }>;
    }>(configPath());
    expect(persistedConfig.schemaVersion).toBe(2);
    expect(persistedConfig.settings).toMatchObject({ theme: "dark", secretsStorage: "file" });
    expect(persistedConfig.selectedConfigurationId).toBe("cfg-v1-gemini");
    expect(persistedConfig.configurations).toEqual([
      expect.objectContaining({
        status: "supported",
        configurationId: "cfg-v1-gemini",
        productId: "gemini",
        selectedModelId: "gemini-2.5-flash",
      }),
    ]);
    expect(readFileSync(configPath(), "utf8")).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);

    const keyPath = literalSecretPathFor("cfg-v1-gemini", 1);
    expect(readJson<{ schemaVersion: number; bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-v1-gemini",
          revision: 1,
          status: "active",
          kind: "file-0600",
          filePath: keyPath,
        },
      ],
    });
    expect(readFileSync(keyPath, "utf8")).toBe("file-key");
  });

  it("runs a configuration action against an upgraded V1 document", async () => {
    writeJson(configPath(), v1Config([v1Gemini()]));
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    const store = await loadStore();

    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-after-upgrade" }),
    );

    expect(created).toMatchObject({ ok: true, value: { status: "succeeded" } });
    const persisted = readJson<{
      schemaVersion: number;
      configurations: Array<{ configurationId: string }>;
    }>(configPath());
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.configurations.map((record) => record.configurationId)).toContain(
      "cfg-v1-gemini",
    );
    expect(persisted.configurations).toHaveLength(2);
  });

  it("copies a stranded keyring-mode literal to its configuration key and drops the provider key", async () => {
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: { gemini: "keyring-key" } });
    const keyringValues = new Map<string, string>([["api_key_gemini", "keyring-key"]]);
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const store = await loadStore();

    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    const bindings = readJson<{ bindings: Array<{ kind: string; keyId?: string }> }>(
      secretsPath(),
    ).bindings;
    expect(bindings[0]).toMatchObject({ kind: "keyring-reference" });
    expect(bindings[0]?.keyId).not.toBe("api_key_gemini");
    expect(keyringValues.get(bindings[0]?.keyId ?? "")).toBe("keyring-key");
    expect(keyringValues.has("api_key_gemini")).toBe(false);
  });

  it("keeps a keyring credential readable under its legacy key when no literal was stranded", async () => {
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: key === "api_key_gemini" ? "keyring-key" : null,
    }));
    const store = await loadStore();

    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    expect(
      readJson<{ bindings: Array<{ kind: string; keyId: string }> }>(secretsPath()).bindings[0],
    ).toMatchObject({ kind: "keyring-reference", keyId: "api_key_gemini" });
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("retains a retired V1 record as a removed V2 record without reading its secret", async () => {
    writeJson(
      configPath(),
      v1Config([
        { provider: REMOVED_PRODUCT_ID, [LEGACY_V1_HAS_API_KEY_PROPERTY]: true, isActive: false },
      ]),
    );
    writeJson(secretsPath(), { providers: { [REMOVED_PRODUCT_ID]: "retired-key" } });
    const store = await loadStore();

    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    const persisted = readJson<{
      selectedConfigurationId: string | null;
      configurations: Array<{ status: string; productId: string }>;
    }>(configPath());
    expect(persisted.selectedConfigurationId).toBeNull();
    expect(persisted.configurations[0]).toMatchObject({
      status: "removed",
      productId: REMOVED_PRODUCT_ID,
    });
    expect(
      readJson<{ bindings: Array<{ status: string }> }>(secretsPath()).bindings[0],
    ).toMatchObject({ status: "removed" });
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });
});

describe("config store settings persistence", () => {
  it("keeps every configuration, the selection, and every binding across a settings and storage change", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord({ selectedModelId: "gemini-2.5-flash" })], "cfg-existing", {
        theme: "auto",
        secretsStorage: "file",
      }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    const store = await loadStore();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });
    await expect(store.updateSettings({ secretsStorage: "keyring" })).resolves.toMatchObject({
      ok: true,
    });

    const persistedConfig = readJson<{
      schemaVersion: number;
      settings: Record<string, unknown>;
      selectedConfigurationId: string | null;
      configurations: Array<{ configurationId: string; selectedModelId: string | null }>;
    }>(configPath());
    expect(persistedConfig.schemaVersion).toBe(2);
    expect(persistedConfig.settings).toMatchObject({ theme: "dark", secretsStorage: "keyring" });
    expect(persistedConfig.selectedConfigurationId).toBe("cfg-existing");
    expect(persistedConfig.configurations).toEqual([
      expect.objectContaining({
        configurationId: "cfg-existing",
        selectedModelId: "gemini-2.5-flash",
      }),
    ]);
    expect(readJson<{ schemaVersion: number; bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ],
    });
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(store.getSettings()).toMatchObject({ theme: "dark", secretsStorage: "keyring" });
  });

  it("preserves settings fields this binary does not know", async () => {
    writeJson(configPath(), v2Config([], null, { theme: "auto", futureSetting: { nested: true } }));
    const store = await loadStore();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });

    expect(readJson<{ settings: Record<string, unknown> }>(configPath()).settings).toMatchObject({
      theme: "dark",
      futureSetting: { nested: true },
    });
  });

  it("refuses to clear secrets storage once it is configured", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "file" }));
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: null })).resolves.toMatchObject({
      ok: false,
      error: { code: "STORAGE_NOT_CONFIGURED" },
    });
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
  });

  it("refuses keyring storage when the keyring is unavailable", async () => {
    keyring.isKeyringAvailable.mockReturnValue(false);
    writeJson(configPath(), v2Config([], null, { secretsStorage: "file" }));
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: "keyring" })).resolves.toMatchObject({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE" },
    });
  });

  it("reports a failed settings commit and leaves the prior document byte-identical", async () => {
    writeJson(configPath(), v2Config([supportedRecord()], null, { theme: "auto" }));
    const store = await loadStore();
    const before = readFileSync(configPath(), "utf8");
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath !== secretsPath()) return false;
      fsHooks.removeFileSyncHook = null;
      throw new Error("Injected secrets removal failure");
    };

    const result = await store.updateSettings({ theme: "dark" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(configPath(), "utf8")).toBe(before);
    expect(store.getSettings().theme).toBe("auto");
  });
});

describe("config store V2 documents", () => {
  it("REMOVED_PRODUCT_ID removed records keep their binding and are never accepted by create, update, select, test, or evidence admission", async () => {
    const removedKeyPath = literalSecretPathFor("cfg-removed", 1);
    writeJson(configPath(), v2Config([removedRecord()]));
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-removed",
          revision: 1,
          kind: "file-0600",
          filePath: removedKeyPath,
          status: "removed",
        },
      ]),
    );
    mkdirSync(dirname(removedKeyPath), { recursive: true });
    writeFileSync(removedKeyPath, "sk-zai-coding-secret", { mode: 0o600 });
    const store = await loadStore();

    const inspected = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-removed",
    });
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        status: "succeeded",
        configuration: {
          configurationId: "cfg-removed",
          status: "removed",
          productId: REMOVED_PRODUCT_ID,
        },
      },
    });

    const created = await store.runConfigurationAction({
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: REMOVED_PRODUCT_ID,
        endpoint: "https://api.REMOVED_PRODUCT_ID.invalid/v1",
        credential: { kind: "literal", value: "sk-zai-coding-never-created" },
      },
    } as unknown as ClientConfigurationAction);
    expect(created).toMatchObject({ ok: false, error: { code: "INVALID_ACTION" } });
    const updated = await store.runConfigurationAction(updateGeminiAction("cfg-removed", 1));
    expect(updated).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    const selected = await store.runConfigurationAction({
      action: "select",
      configurationId: "cfg-removed",
      modelId: "gemini-2.5-flash",
    });
    expect(selected).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    const tested = await store.runConfigurationAction({
      action: "test",
      configurationId: "cfg-removed",
    });
    expect(tested).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    const evidenced = await store.recordConfigurationEvidence(
      "cfg-removed",
      evidenceFor("cfg-removed"),
    );
    expect(evidenced).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });

    expect(existsSync(removedKeyPath)).toBe(true);
    expect(readFileSync(removedKeyPath, "utf8")).toBe("sk-zai-coding-secret");
    const persistedSecrets = readJson<{ bindings: Array<{ configurationId: string }> }>(
      secretsPath(),
    );
    expect(
      persistedSecrets.bindings.some((binding) => binding.configurationId === "cfg-removed"),
    ).toBe(true);
    const persistedConfig = readJson<{ configurations: Array<{ configurationId: string }> }>(
      configPath(),
    );
    expect(
      persistedConfig.configurations.some((record) => record.configurationId === "cfg-removed"),
    ).toBe(true);
  });

  it("unknown future records keep their exact bytes when a neighboring record is deleted", async () => {
    const unknownRecord =
      '{"schemaVersion":99,"configurationId":"cfg-future","futureField":{"nested":true},"oddValue":"\\u0041"}';
    const recordA = JSON.stringify(supportedRecord({ configurationId: "cfg-a" }));
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${recordA},${unknownRecord}]}\n`,
    );
    const store = await loadStore();

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-a",
      expectedRevision: 1,
    });
    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });

    const text = readFileSync(configPath(), "utf8");
    expect(text).toContain(unknownRecord);
    const persisted = readJson<{
      schemaVersion: number;
      configurations: Array<{ configurationId: string }>;
    }>(configPath());
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.configurations).toHaveLength(1);
    expect(persisted.configurations[0]?.configurationId).toBe("cfg-future");
  });

  it("V2 store actions never write [LEGACY_V1_HAS_API_KEY_PROPERTY] into config.json", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-no-hasapikey" }),
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

    const configText = readFileSync(configPath(), "utf8");
    expect(configText).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(readFileSync(secretsPath(), "utf8")).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
  });
});
