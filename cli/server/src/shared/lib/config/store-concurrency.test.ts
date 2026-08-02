import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  loadStore,
  loadStoreFactory,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const v2Config = (records: unknown[] = []) => ({
  schemaVersion: 2,
  settings: {},
  selectedConfigurationId: null,
  configurations: records,
});

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const createGeminiAction = (value: string) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential: { kind: "literal", value },
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

describe("config store concurrency", () => {
  it("serializes V2 actions across store instances so the second sees the first's persisted state", async () => {
    writeJson(configPath(), v2Config());
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    const created = await storeA.runConfigurationAction(createGeminiAction("shared-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const inspected = await storeB.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });

  it("does not resurrect deleted credentials from stale in-memory state", async () => {
    writeJson(configPath(), v2Config());
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    const created = await storeA.runConfigurationAction(createGeminiAction("delete-me-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const deleted = await storeB.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });
    expect(deleted).toMatchObject({ ok: true, value: { status: "succeeded" } });

    const staleUpdate = await storeA.runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(staleUpdate).toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });

    const replacement = await storeA.runConfigurationAction(createGeminiAction("replacement-key"));
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;

    const secrets = readJson<{ bindings: Array<{ configurationId: string }> }>(secretsPath());
    expect(secrets.bindings.some((binding) => binding.configurationId === configurationId)).toBe(
      false,
    );
    const config = readJson<{ configurations: Array<{ configurationId: string }> }>(configPath());
    expect(config.configurations.some((record) => record.configurationId === configurationId)).toBe(
      false,
    );
  });

  it("rejects a stale revision when another store already updated the record", async () => {
    writeJson(configPath(), v2Config());
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    const created = await storeA.runConfigurationAction(createGeminiAction("first-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const firstUpdate = await storeB.runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(firstUpdate.ok).toBe(true);

    const staleUpdate = await storeA.runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(staleUpdate).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });

    const persisted = readJson<{ configurations: Array<{ revision: number }> }>(configPath());
    expect(persisted.configurations[0]?.revision).toBe(2);
  });

  it("serializes concurrent creates on one store so every mutation is persisted", async () => {
    writeJson(configPath(), v2Config());
    const store = await loadStore();

    const results = await Promise.all([
      store.runConfigurationAction(createGeminiAction("key-a")),
      store.runConfigurationAction(createGeminiAction("key-b")),
      store.runConfigurationAction(createGeminiAction("key-c")),
    ]);

    const configurationIds = results.map((result) => {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("concurrent create failed");
      return result.value.configuration?.configurationId;
    });
    expect(new Set(configurationIds).size).toBe(3);

    const persisted = readJson<{ configurations: Array<{ configurationId: string }> }>(
      configPath(),
    );
    expect(persisted.configurations).toHaveLength(3);
    for (const configurationId of configurationIds) {
      expect(
        persisted.configurations.some((record) => record.configurationId === configurationId),
      ).toBe(true);
    }
  });

  it("restores the config file when the secrets write fails midway through a delete", async () => {
    writeJson(configPath(), v2Config());
    const store = await loadStore();
    const created = await store.runConfigurationAction(createGeminiAction("rollback-key"));
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
    expect(readFileSync(literalSecretPathFor(configurationId, 1), "utf8")).toBe("rollback-key");

    fsHooks.removeFileSyncHook = null;
    const inspected = await store.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });
});
