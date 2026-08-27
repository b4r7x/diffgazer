import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { atomicWriteFile } from "../fs.js";
import { getConfigurationSecretName } from "./secrets-store.js";
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

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const seedPendingKeyringTombstone = (secretsStorage: "file" | "keyring" = "keyring") => {
  const oldKeyId = "diffgazer/cfg-existing/retired";
  const activeKeyId = getConfigurationSecretName("cfg-existing", 1);
  const keyringValues = new Map<string, string>([
    [oldKeyId, "sk-proj-retired"],
    [activeKeyId, "sk-proj-active"],
  ]);
  writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing", { secretsStorage }));
  writeJson(
    secretsPath(),
    v2Secrets([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: activeKeyId,
        status: "active",
      },
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: oldKeyId,
        status: "removed",
      },
    ]),
  );
  keyring.readKeyringSecret.mockImplementation((key: string) => ({
    ok: true,
    value: keyringValues.get(key) ?? null,
  }));
  keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
    ok: true,
    value: keyringValues.delete(key),
  }));
  return { oldKeyId, activeKeyId, keyringValues };
};

describe("config store settings persistence", () => {
  it("migrates existing file-backed bindings when secrets storage switches to keyring", async () => {
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
          kind: "keyring-reference",
          keyId: expect.stringContaining("cfg-existing"),
          status: "active",
        },
      ],
    });
    expect(existsSync(keyPath)).toBe(false);
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "dark", secretsStorage: "keyring" },
    });
  });

  it("keeps the old credential readable when a secrets-storage migration persist fails", async () => {
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
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const store = await loadStore();

    fsHooks.atomicWriteFileHook = async (filePath) => {
      if (filePath === secretsPath() || filePath === configPath()) {
        fsHooks.atomicWriteFileHook = null;
        throw new Error("Injected secrets-storage migration persist failure");
      }
    };

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      { secretsStorage: "file" },
    );
    expect(
      readJson<{ bindings: Array<{ kind: string; filePath?: string }> }>(secretsPath()),
    ).toEqual({
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
    expect(keyringValues.size).toBe(0);
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { secretsStorage: "file" },
    });
  });

  it("keeps old and new migration credentials when rollback-tombstone WAL cleanup cannot be completed", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const destinationKey = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map<string, string>();
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
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
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    let journalWrites = 0;
    let mainSecretsWriteFailed = false;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      if (filePath === secretsPath() && !mainSecretsWriteFailed) {
        mainSecretsWriteFailed = true;
        throw new Error("Injected initial migration persist failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts >= 2) {
          throw new Error("Injected persistent recovery unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };
    keyring.deleteKeyringSecret.mockClear();

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.get(destinationKey)).toBe("sk-proj-existing");
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "file-0600",
        filePath: keyPath,
        status: "active",
      },
    ]);
  });

  it("cleans up a new migration credential after a one-shot rollback-tombstone WAL failure", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const destinationKey = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map<string, string>();
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
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
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    let journalWrites = 0;
    let mainSecretsWriteFailed = false;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      if (filePath === secretsPath() && !mainSecretsWriteFailed) {
        mainSecretsWriteFailed = true;
        throw new Error("Injected initial migration persist failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts === 2) {
          fsHooks.removeFileSyncDurableHook = null;
          throw new Error("Injected one-shot recovery unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };
    keyring.deleteKeyringSecret.mockClear();

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(destinationKey);
    expect(keyringValues.has(destinationKey)).toBe(false);
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("does not report settings success when post-commit tombstone clearing latches ROLLBACK_FAILED", async () => {
    const { oldKeyId, activeKeyId, keyringValues } = seedPendingKeyringTombstone();
    keyring.deleteKeyringSecret.mockImplementation(() => ({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    }));
    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => expect(keyring.deleteKeyringSecret).toHaveBeenCalled());
    keyring.deleteKeyringSecret.mockClear();
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));

    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWrites = 0;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts >= 2) {
          throw new Error("Injected persistent tombstone-clear unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };

    const failed = await store.updateSettings({ theme: "dark" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(oldKeyId);
    expect(keyringValues.has(oldKeyId)).toBe(false);
    expect(keyringValues.has(activeKeyId)).toBe(true);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(
      readJson<{ bindings: Array<{ keyId?: string; status: string }> }>(secretsPath()).bindings,
    ).toEqual([
      expect.objectContaining({ keyId: activeKeyId, status: "active" }),
      expect.objectContaining({ keyId: oldKeyId, status: "removed" }),
    ]);

    const later = await store.updateSettings({ theme: "light" });
    expect(later).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
  });

  it("stops a storage migration when preflight tombstone clearing cannot be finalized", async () => {
    const { oldKeyId, activeKeyId, keyringValues } = seedPendingKeyringTombstone("file");
    keyring.deleteKeyringSecret.mockImplementation(() => ({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    }));
    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => expect(keyring.deleteKeyringSecret).toHaveBeenCalled());
    keyring.deleteKeyringSecret.mockClear();
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));

    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWrites = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath)
        throw new Error("Injected persistent preflight unlink failure");
      return false;
    };

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(oldKeyId);
    expect(keyringValues.has(oldKeyId)).toBe(false);
    expect(keyringValues.has(activeKeyId)).toBe(true);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
    expect(
      readJson<{ bindings: Array<{ keyId?: string; status: string }> }>(secretsPath()).bindings,
    ).toEqual([
      expect.objectContaining({ keyId: activeKeyId, status: "active" }),
      expect.objectContaining({ keyId: oldKeyId, status: "removed" }),
    ]);
  });

  it("retries a failed keyring cleanup from its persisted tombstone after restart", async () => {
    const oldKeyId = "diffgazer/cfg-existing/1";
    const keyringValues = new Map<string, string>([[oldKeyId, "sk-proj-existing"]]);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "keyring" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: oldKeyId,
          status: "active",
        },
      ]),
    );
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === oldKeyId) {
        return { ok: false, error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" } };
      }
      return { ok: true, value: keyringValues.delete(key) };
    });
    const store = await loadStore();

    const migrated = await store.updateSettings({ secretsStorage: "file" });

    expect(migrated).toMatchObject({ ok: true, value: { secretsStorage: "file" } });
    expect(keyringValues.get(oldKeyId)).toBe("sk-proj-existing");
    expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor("cfg-existing", 1),
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: oldKeyId,
          status: "removed",
        },
      ],
    });
    expect(readFileSync(literalSecretPathFor("cfg-existing", 1), "utf8")).toBe("sk-proj-existing");

    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(keyringValues.has(oldKeyId)).toBe(false);
      expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor("cfg-existing", 1),
          status: "active",
        },
      ]);
    });
    expect(readFileSync(literalSecretPathFor("cfg-existing", 1), "utf8")).toBe("sk-proj-existing");
  });

  it("never deletes a canonical keyring target shared by an active binding and tombstone", async () => {
    const keyId = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map([[keyId, "active-secret"]]);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "keyring" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "removed",
        },
      ]),
    );
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));

    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "active",
        },
      ]);
    });

    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.get(keyId)).toBe("active-secret");
  });

  it("retries a failed file cleanup from its persisted tombstone after restart", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
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
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    const store = await loadStore();

    chmodSync(dirname(keyPath), 0o500);
    try {
      const migrated = await store.updateSettings({ secretsStorage: "keyring" });

      expect(migrated).toMatchObject({ ok: true, value: { secretsStorage: "keyring" } });
      expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
      expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
        schemaVersion: 2,
        bindings: [
          {
            configurationId: "cfg-existing",
            revision: 1,
            kind: "keyring-reference",
            keyId: expect.stringContaining("cfg-existing"),
            status: "active",
          },
          {
            configurationId: "cfg-existing",
            revision: 1,
            kind: "file-0600",
            filePath: keyPath,
            status: "removed",
          },
        ],
      });
    } finally {
      chmodSync(dirname(keyPath), 0o700);
    }

    // No polling: `ready()` drains the startup tombstone retry, so the cleanup has already
    // run by the time it resolves. Work that outlives `ready()` escapes the temp home.
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(existsSync(keyPath)).toBe(false);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: expect.stringContaining("cfg-existing"),
        status: "active",
      },
    ]);
    expect(keyringValues.size).toBe(1);
  });

  it("retains a rollback-created binding tombstone when its cleanup also fails", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const newKeyId = getConfigurationSecretName("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
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
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === newKeyId) {
        return { ok: false, error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" } };
      }
      return { ok: true, value: keyringValues.delete(key) };
    });
    const store = await loadStore();

    fsHooks.atomicWriteFileHook = async (filePath) => {
      if (filePath === configPath() || filePath === secretsPath()) {
        fsHooks.atomicWriteFileHook = null;
        throw new Error("Injected settings commit failure");
      }
    };

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(keyringValues.get(newKeyId)).toBe("sk-proj-existing");
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
    expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: newKeyId,
          status: "removed",
        },
      ],
    });

    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(keyringValues.has(newKeyId)).toBe(false);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "file-0600",
        filePath: keyPath,
        status: "active",
      },
    ]);
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
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

  it("updates unrelated settings on a keyring install without probing the keyring", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "keyring", theme: "auto" }));
    const store = await loadStore();
    keyring.isKeyringAvailable.mockReturnValue(false);
    keyring.isKeyringAvailable.mockClear();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });

    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(readJson<{ settings: Record<string, unknown> }>(configPath()).settings).toMatchObject({
      secretsStorage: "keyring",
      theme: "dark",
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
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "auto" },
    });
  });
});
