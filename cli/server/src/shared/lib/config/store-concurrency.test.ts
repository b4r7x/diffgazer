import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
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

const { readProbe } = vi.hoisted(() => ({
  readProbe: { active: false, configurationReloads: 0, evidenceReads: 0 },
}));

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const observedReadFileSync = ((...args: Parameters<typeof real.readFileSync>) => {
    if (readProbe.active) {
      const filePath = String(args[0]).replaceAll("\\", "/");
      if (filePath.endsWith("/config.json")) readProbe.configurationReloads += 1;
      if (filePath.includes("/evidence/")) readProbe.evidenceReads += 1;
    }
    return real.readFileSync(...args);
  }) as typeof real.readFileSync;
  const defaultFs = { ...real, readFileSync: observedReadFileSync };
  return {
    ...real,
    readFileSync: observedReadFileSync,
    default: defaultFs,
  };
});

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_BUDGET = {
  inputTokens: 200_000,
  outputTokens: 8_192,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};
const CREATED_AT = "2026-01-01T00:00:00.000Z";

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

  it("reconciles a hot journal under both locks before a second store reloads", async () => {
    writeJson(configPath(), v2Config());
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const created = await storeA.runConfigurationAction(createGeminiAction("hot-journal-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const configBefore = readFileSync(configPath());
    const secretsBefore = readFileSync(secretsPath());
    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const failed = await storeA.runConfigurationAction(updateGeminiAction(configurationId, 1));
    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(existsSync(recoveryPath)).toBe(true);

    fsHooks.removeFileSyncDurableHook = null;
    const storeB = createStore();
    expect(await storeB.ready()).toEqual({ ok: true, value: undefined });
    expect(existsSync(recoveryPath)).toBe(false);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);

    const inspected = await storeB.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });

  it("captures rows, selection, and settings from one queued revision", async () => {
    writeJson(configPath(), v2Config());
    const store = await loadStore();
    const created = await store.runConfigurationAction(createGeminiAction("snapshot-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    const selected = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    expect(selected.ok).toBe(true);

    const settingsUpdate = store.updateSettings({ theme: "dark" });
    const snapshotRead = store.readConfigurationSnapshot();
    const deletion = store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });
    const [settingsResult, snapshot, deleteResult] = await Promise.all([
      settingsUpdate,
      snapshotRead,
      deletion,
    ]);

    expect(settingsResult.ok).toBe(true);
    expect(deleteResult.ok).toBe(true);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.settings.theme).toBe("dark");
    expect(snapshot.value.selectedConfigurationId).toBe(configurationId);
    expect(
      snapshot.value.configurations.some(
        ({ configuration }) => configuration.configurationId === configurationId,
      ),
    ).toBe(true);
  });

  it("keeps store revalidation bounded and evidence reads linear as configurations grow", async () => {
    const createStore = await loadStoreFactory();
    const readsByConfigurationCount = [];

    for (const configurationCount of [2, 7]) {
      const configurations = Array.from({ length: configurationCount }, (_, index) => {
        const configurationId = `cfg-snapshot-${configurationCount}-${index}`;
        return {
          schemaVersion: 2,
          status: "supported",
          configurationId,
          revision: 1,
          transportFamily: "hosted-api",
          productId: "gemini",
          input: {
            transportFamily: "hosted-api",
            productId: "gemini",
            endpoint: GEMINI_ENDPOINT,
          },
          selectedModelId: "gemini-2.5-flash",
          acknowledgement: {
            noticeId: "gemini-hosted-api",
            noticeVersion: 1,
            acceptedAt: CREATED_AT,
          },
          evidenceReference: `evidence-${configurationId}`,
          budget: DEFAULT_BUDGET,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        };
      });
      writeJson(configPath(), v2Config(configurations));
      const store = createStore();
      expect(await store.ready()).toEqual({ ok: true, value: undefined });

      readProbe.configurationReloads = 0;
      readProbe.evidenceReads = 0;
      readProbe.active = true;
      const snapshot = await store.readConfigurationSnapshot().finally(() => {
        readProbe.active = false;
      });

      expect(snapshot.ok).toBe(true);
      if (!snapshot.ok) return;
      expect(snapshot.value.configurations).toHaveLength(configurationCount);
      readsByConfigurationCount.push({
        configurationCount,
        configurationReloads: readProbe.configurationReloads,
        evidenceReads: readProbe.evidenceReads,
      });
    }

    expect(readsByConfigurationCount).toEqual([
      { configurationCount: 2, configurationReloads: 2, evidenceReads: 2 },
      { configurationCount: 7, configurationReloads: 2, evidenceReads: 7 },
    ]);
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
