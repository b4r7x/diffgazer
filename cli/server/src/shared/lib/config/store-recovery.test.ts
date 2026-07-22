import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import {
  catalog,
  configPath,
  diffgazerHome,
  expectFileMissingEventually,
  fsHooks,
  keyring,
  loadStore,
  loadStoreFactory,
  readJson,
  readJsonEventually,
  secretsPath,
  secretsRecoveryPath,
  trustConfig,
  trustPath,
  writeJson,
} from "./store.test-support.js";

describe("config store", () => {
  it("rolls back file-backed credential writes when config persistence fails", async () => {
    const store = await loadStore();
    await store.updateSettings({ secretsStorage: "file" });
    fsHooks.writeJsonFileHook = async (filePath, data, _mode) => {
      if (filePath.endsWith("config.json")) {
        throw new Error("Injected config.json write failure");
      }
      writeJson(filePath, data);
      return undefined;
    };

    try {
      const result = await store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "new-key",
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "PERSIST_FAILED" },
      });
      expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: null });
      await expectFileMissingEventually(secretsPath());
    } finally {
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("restores deleted file-backed credentials when config persistence fails", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "existing-key" } });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath, data, _mode) => {
      if (filePath.endsWith("config.json")) {
        throw new Error("Injected config.json write failure");
      }
      writeJson(filePath, data);
      return undefined;
    };

    try {
      const result = await store.deleteProviderCredentials("gemini");

      expect(result).toMatchObject({
        ok: false,
        error: { code: "PERSIST_FAILED" },
      });
      expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "existing-key" });
      expect(store.getProviders().find((provider) => provider.provider === "gemini")).toMatchObject(
        {
          hasApiKey: true,
          isActive: true,
        },
      );
      expect(readJson<{ providers: Record<string, string> }>(secretsPath())).toEqual({
        providers: { gemini: "existing-key" },
      });
    } finally {
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("recovers an interrupted file-backed credential update after restart", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    const futureEntry = { kind: "future-ref", value: "opaque-value" };
    writeJson(secretsPath(), {
      providers: { gemini: "old-key", openrouter: "", future_provider: futureEntry },
    });
    const store = await loadStore();
    const events: string[] = [];
    let secretsWriteCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      if (filePath === secretsRecoveryPath()) {
        events.push("recovery");
        writeJson(filePath, data);
        if (mode !== undefined) chmodSync(filePath, mode);
        return;
      }
      if (filePath === secretsPath()) {
        secretsWriteCount += 1;
        events.push(secretsWriteCount === 1 ? "secrets-primary" : "secrets-rollback");
        if (secretsWriteCount === 2) throw new Error("Injected secrets rollback failure");
        writeJson(filePath, data);
        return;
      }
      if (filePath === configPath()) {
        events.push("config-failed");
        throw new Error("Injected config write failure");
      }
      writeJson(filePath, data);
    };

    const result = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(events).toEqual(["recovery", "secrets-primary", "config-failed", "secrets-rollback"]);
    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "new-key",
    );
    expect(existsSync(secretsRecoveryPath())).toBe(true);
    expect(statSync(secretsRecoveryPath()).mode & 0o777).toBe(0o600);
    expect(
      readJson<{
        previousConfigFileExisted: boolean;
        previousFileExisted: boolean;
        previousSecrets: { providers: Record<string, unknown> };
      }>(secretsRecoveryPath()),
    ).toMatchObject({
      previousConfigFileExisted: true,
      previousFileExisted: true,
      previousSecrets: {
        providers: { gemini: "old-key", openrouter: "", future_provider: futureEntry },
      },
    });

    fsHooks.writeJsonFileHook = null;
    const restartedStore = (await loadStoreFactory())();
    await expect(restartedStore.ready()).resolves.toMatchObject({ ok: true });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({ ok: true, value: "old-key" });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "old-key",
    );
    expect(readJson<{ providers: Record<string, unknown> }>(secretsPath()).providers).toMatchObject(
      {
        openrouter: "",
        future_provider: futureEntry,
      },
    );
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("recovers an interrupted file-backed credential create after restart", async () => {
    writeJson(configPath(), { settings: { secretsStorage: "file" }, providers: [] });
    const store = await loadStore();
    const events: string[] = [];
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath === secretsRecoveryPath()) {
        events.push("recovery");
        writeJson(filePath, data);
        return;
      }
      if (filePath === secretsPath()) {
        events.push("secrets-primary");
        writeJson(filePath, data);
        return;
      }
      if (filePath === configPath()) {
        events.push("config-failed");
        throw new Error("Injected config write failure");
      }
      writeJson(filePath, data);
    };
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) {
        events.push("secrets-rollback");
        throw new Error("Injected secrets rollback failure");
      }
      return false;
    };

    const result = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "created-key",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(events).toEqual(["recovery", "secrets-primary", "config-failed", "secrets-rollback"]);
    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(existsSync(secretsRecoveryPath())).toBe(true);

    fsHooks.writeJsonFileHook = null;
    fsHooks.removeFileSyncHook = null;
    const restartedStore = (await loadStoreFactory())();
    await expect(restartedStore.ready()).resolves.toMatchObject({ ok: true });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({ ok: true, value: null });
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("recovers an interrupted file-backed credential delete after restart", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    writeJson(secretsPath(), { providers: { gemini: "old-key" } });
    const store = await loadStore();
    const events: string[] = [];
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) {
        events.push("secrets-primary");
        rmSync(filePath, { force: true });
        return true;
      }
      return false;
    };
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath === secretsRecoveryPath()) {
        events.push("recovery");
        writeJson(filePath, data);
        return;
      }
      if (filePath === configPath()) {
        events.push("config-failed");
        throw new Error("Injected config write failure");
      }
      if (filePath === secretsPath()) {
        events.push("secrets-rollback");
        throw new Error("Injected secrets rollback failure");
      }
      writeJson(filePath, data);
    };

    const result = await store.deleteProviderCredentials("gemini");

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(events).toEqual(["recovery", "secrets-primary", "config-failed", "secrets-rollback"]);
    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(existsSync(secretsRecoveryPath())).toBe(true);

    fsHooks.writeJsonFileHook = null;
    fsHooks.removeFileSyncHook = null;
    const restartedStore = (await loadStoreFactory())();
    await expect(restartedStore.ready()).resolves.toMatchObject({ ok: true });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({ ok: true, value: "old-key" });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "old-key",
    );
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("does not mutate secrets when the recovery record cannot be persisted", async () => {
    writeJson(configPath(), { settings: { secretsStorage: "file" }, providers: [] });
    const store = await loadStore();
    const writes: string[] = [];
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      writes.push(filePath);
      if (filePath === secretsRecoveryPath()) {
        throw new Error("Injected recovery record write failure");
      }
      writeJson(filePath, data);
    };

    const result = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(writes).toEqual([secretsRecoveryPath()]);
    expect(existsSync(secretsPath())).toBe(false);
  });

  it("returns rollback-failed when keyring compensation cannot restore the prior value", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    let keyringValue = "old-key";
    keyring.readKeyringSecret.mockImplementation(() => ({ ok: true, value: keyringValue }));
    keyring.writeKeyringSecret.mockImplementation((_name, value) => {
      if (value === "old-key" && keyringValue === "new-key") {
        return {
          ok: false,
          error: { code: "KEYRING_WRITE_FAILED", message: "Injected keyring rollback failure" },
        };
      }
      keyringValue = value;
      return { ok: true, value: undefined };
    });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath === configPath()) throw new Error("Injected config write failure");
      writeJson(filePath, data);
    };

    const result = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(keyringValue).toBe("new-key");
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "new-key" });
  });

  it("fails closed when the startup recovery record is corrupt", async () => {
    writeJson(configPath(), { settings: { secretsStorage: "file" }, providers: [] });
    writeJson(secretsPath(), { providers: { gemini: "uncommitted-key" } });
    writeFileSync(secretsRecoveryPath(), "{ malformed", "utf-8");

    const store = await loadStore();

    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    await expect(
      store.saveProviderCredentials({ provider: "gemini", apiKey: "another-key" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "uncommitted-key",
    );
  });

  it("keeps a failed startup replay pending and blocks ordinary mutations", async () => {
    const previousConfig = { settings: { secretsStorage: "file" }, providers: [] };
    writeJson(configPath(), previousConfig);
    writeJson(secretsPath(), { providers: { gemini: "uncommitted-key" } });
    writeJson(secretsRecoveryPath(), {
      version: 1,
      previousConfigFileExisted: true,
      previousConfig,
      previousFileExisted: true,
      previousSecrets: { providers: { gemini: "old-key" } },
    });
    fsHooks.writeJsonFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error("Injected startup replay failure");
    };

    const store = await loadStore();

    expect(existsSync(secretsRecoveryPath())).toBe(true);
    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    await expect(store.deleteProviderCredentials("gemini")).resolves.toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "uncommitted-key",
    );
  });

  it("does not replay another store's WAL while that store still owns the config lock", async () => {
    const previousConfig = {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    };
    writeJson(configPath(), previousConfig);
    writeJson(secretsPath(), { providers: { gemini: "old-key" } });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    await expect(storeA.ready()).resolves.toMatchObject({ ok: true });

    let releaseSecretsWrite = () => {};
    const secretsWriteHeld = new Promise<void>((resolve) => {
      releaseSecretsWrite = resolve;
    });
    let markSecretsWritten = () => {};
    const secretsWritten = new Promise<void>((resolve) => {
      markSecretsWritten = resolve;
    });
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      const { writeJsonFile } = await vi.importActual<typeof import("../fs.js")>("../fs.js");
      await writeJsonFile(filePath, data, mode);
      if (filePath === secretsPath()) {
        markSecretsWritten();
        await secretsWriteHeld;
      }
    };

    const save = storeA.saveProviderCredentials({ provider: "gemini", apiKey: "new-key" });
    await secretsWritten;
    expect(existsSync(secretsRecoveryPath())).toBe(true);
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "new-key",
    );

    const storeB = createStore();
    expect(storeB.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    await Promise.resolve();
    expect(existsSync(secretsRecoveryPath())).toBe(true);
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "new-key",
    );

    releaseSecretsWrite();
    await expect(save).resolves.toMatchObject({ ok: true });
    await expect(storeB.ready()).resolves.toMatchObject({ ok: true });
    expect(storeB.getProviderApiKey("gemini")).toEqual({ ok: true, value: "new-key" });
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("replays a crashed store's WAL only after acquiring the released config lock", async () => {
    const previousConfig = {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    };
    writeJson(configPath(), previousConfig);
    writeJson(secretsPath(), { providers: { gemini: "old-key" } });
    const { withConfigFileTransaction } = await import("./persistence/config.js");
    let releaseOwner = () => {};
    const ownerHeld = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    let markPartialWrite = () => {};
    const partialWriteDone = new Promise<void>((resolve) => {
      markPartialWrite = resolve;
    });
    const owner = withConfigFileTransaction(async () => {
      writeJson(secretsRecoveryPath(), {
        version: 1,
        previousConfigFileExisted: true,
        previousConfig,
        previousFileExisted: true,
        previousSecrets: { providers: { gemini: "old-key" } },
      });
      writeJson(secretsPath(), { providers: { gemini: "uncommitted-key" } });
      markPartialWrite();
      await ownerHeld;
    });
    await partialWriteDone;

    const storeB = (await loadStoreFactory())();
    expect(storeB.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "uncommitted-key",
    );
    expect(existsSync(secretsRecoveryPath())).toBe(true);

    releaseOwner();
    await owner;
    await expect(storeB.ready()).resolves.toMatchObject({ ok: true });
    expect(storeB.getProviderApiKey("gemini")).toEqual({ ok: true, value: "old-key" });
    expect(readJson(secretsPath())).toEqual({ providers: { gemini: "old-key" } });
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("retains recovery evidence when cleanup and config rollback both fail", async () => {
    writeJson(configPath(), { settings: { secretsStorage: "file" }, providers: [] });
    const store = await loadStore();
    const events: string[] = [];
    let configWriteCount = 0;
    let recoveryRemovalCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath === secretsRecoveryPath()) {
        events.push("recovery");
      } else if (filePath === secretsPath()) {
        events.push(events.includes("config-committed") ? "secrets-rollback" : "secrets-primary");
      } else if (filePath === configPath()) {
        configWriteCount += 1;
        if (configWriteCount === 2) {
          events.push("config-rollback-failed");
          throw new Error("Injected config rollback failure");
        }
        events.push("config-committed");
      }
      writeJson(filePath, data);
    };
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath !== secretsRecoveryPath()) return false;
      recoveryRemovalCount += 1;
      if (recoveryRemovalCount === 1) {
        events.push("cleanup-failed");
        throw new Error("Injected recovery cleanup failure");
      }
      rmSync(filePath, { force: true });
      return true;
    };

    const result = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(events).toEqual([
      "recovery",
      "secrets-primary",
      "config-committed",
      "cleanup-failed",
      "config-rollback-failed",
    ]);
    expect(store.getProviderApiKey("gemini")).toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
    expect(readJson<{ providers: Record<string, string> }>(secretsPath()).providers.gemini).toBe(
      "new-key",
    );
    expect(existsSync(secretsRecoveryPath())).toBe(true);

    fsHooks.writeJsonFileHook = null;
    fsHooks.removeFileSyncHook = null;
    const restartedStore = (await loadStoreFactory())();
    await expect(restartedStore.ready()).resolves.toMatchObject({ ok: true });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({ ok: true, value: null });
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(secretsRecoveryPath())).toBe(false);
    expect(readJson<{ providers: unknown[] }>(configPath()).providers).toEqual([]);
  });
});
