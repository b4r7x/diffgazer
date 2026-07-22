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
  it("migrates file secrets to keyring and removes the file secrets store", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    // Return the written value so the migration's read-back verification succeeds.
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "file-key" });
    const store = await loadStore();

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: true });
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "file-key");
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    await expectFileMissingEventually(secretsPath());
  });

  it("reports rollback failure when a failed file-to-keyring migration cannot restore keyring", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    let keyringValue: string | null = null;
    keyring.readKeyringSecret.mockImplementation(() => ({ ok: true, value: keyringValue }));
    keyring.writeKeyringSecret.mockImplementation((_name, value) => {
      keyringValue = value;
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_DELETE_FAILED", message: "rollback delete failed" },
    });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      if (filePath === configPath()) {
        throw new Error("Injected config persistence failure");
      }
      writeJson(filePath, data);
      if (mode !== undefined) chmodSync(filePath, mode);
    };

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(keyringValue).toBe("file-key");
    expect(store.getSettings().secretsStorage).toBe("file");
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "file-key" });
    expect(readJson(secretsPath())).toEqual({ providers: { gemini: "file-key" } });
    expect(existsSync(secretsRecoveryPath())).toBe(false);
  });

  it("preserves a keyring credential across a legacy null restart and keyring reselection", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    let keyringValue: string | null = "keyring-key";
    keyring.readKeyringSecret.mockImplementation(() => ({ ok: true, value: keyringValue }));
    keyring.deleteKeyringSecret.mockImplementation(() => {
      keyringValue = null;
      return { ok: true, value: true };
    });
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: null })).resolves.toMatchObject({
      ok: false,
      error: { code: "STORAGE_NOT_CONFIGURED" },
    });
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "keyring",
      },
    );

    writeJson(configPath(), {
      settings: { secretsStorage: null },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    vi.resetModules();
    const restartedStore = await loadStore();
    await Promise.resolve();

    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValue).toBe("keyring-key");
    await expect(
      restartedStore.updateSettings({ secretsStorage: "keyring" }),
    ).resolves.toMatchObject({ ok: true });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({
      ok: true,
      value: "keyring-key",
    });
  });

  it("preserves a file credential across a legacy null restart and file reselection", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: null })).resolves.toMatchObject({
      ok: false,
      error: { code: "STORAGE_NOT_CONFIGURED" },
    });

    writeJson(configPath(), {
      settings: { secretsStorage: null },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    vi.resetModules();
    const restartedStore = await loadStore();
    await Promise.resolve();

    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    await expect(restartedStore.updateSettings({ secretsStorage: "file" })).resolves.toMatchObject({
      ok: true,
    });
    expect(restartedStore.getProviderApiKey("gemini")).toEqual({
      ok: true,
      value: "file-key",
    });
    expect(readJson(secretsPath())).toEqual({ providers: { gemini: "file-key" } });
  });

  it("restores durable file storage when removing the old secrets file fails", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    let keyringValue: string | null = null;
    keyring.writeKeyringSecret.mockImplementation((_name, value) => {
      keyringValue = value;
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation(() => ({ ok: true, value: keyringValue }));
    keyring.deleteKeyringSecret.mockImplementation(() => {
      const deleted = keyringValue !== null;
      keyringValue = null;
      return { ok: true, value: deleted };
    });
    const store = await loadStore();
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) {
        fsHooks.removeFileSyncHook = null;
        throw new Error("Injected secrets.json removal failure");
      }
      return false;
    };

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(store.getSettings().secretsStorage).toBe("file");
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "file-key" });
    const persistedConfig = readJson<{
      settings: { secretsStorage: string | null };
      providers: Array<{
        provider: string;
        hasApiKey: boolean;
        isActive: boolean;
        model?: string;
      }>;
    }>(configPath());
    expect(persistedConfig.settings.secretsStorage).toBe("file");
    expect(persistedConfig.providers.find((provider) => provider.provider === "gemini")).toEqual({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    expect(readJson(secretsPath())).toEqual({ providers: { gemini: "file-key" } });
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    expect(keyringValue).toBeNull();

    fsHooks.removeFileSyncHook = null;
    vi.resetModules();
    const reloadedStore = await loadStore();
    await expect(reloadedStore.ready()).resolves.toMatchObject({ ok: true });
    expect(reloadedStore.getSettings().secretsStorage).toBe("file");
    expect(reloadedStore.getProviderApiKey("gemini")).toEqual({ ok: true, value: "file-key" });
  });

  it("persists the file copy BEFORE deleting keyring entries when migrating keyring->file (crash-safety)", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });

    const events: string[] = [];
    keyring.deleteKeyringSecret.mockImplementation(() => {
      events.push(`delete:${existsSync(secretsPath()) ? "file-exists" : "file-missing"}`);
      return { ok: true, value: true };
    });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    const result = await store.updateSettings({ secretsStorage: "file" });

    expect(result).toMatchObject({ ok: true });
    // The file existed before the keyring delete, so a crash between persist and
    // finalizeKeyringDeletions leaves the secret safely on disk.
    expect(events).toEqual(["delete:file-exists"]);
    expect(readJson<{ providers: Record<string, string> }>(secretsPath())).toEqual({
      providers: { gemini: "keyring-key" },
    });
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("preserves the keyring entry if the file persist fails (re-runnable migration)", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });

    const store = await loadStore();

    let configWriteCount = 0;
    fsHooks.writeJsonFileHook = async (filePath: string, data: unknown, _mode?: number) => {
      if (filePath.endsWith("secrets.json")) {
        throw new Error("Injected secrets.json write failure");
      }
      if (filePath === configPath()) configWriteCount++;
      writeJson(filePath, data);
      return undefined;
    };

    try {
      const result = await store.updateSettings({ secretsStorage: "file" });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "PERSIST_FAILED" },
      });
      expect(configWriteCount).toBe(0);
      expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
      expect(existsSync(secretsPath())).toBe(false);
    } finally {
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("returns an error when keyring migration is requested but unavailable", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    keyring.isKeyringAvailable.mockReturnValue(false);
    const store = await loadStore();

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE" },
    });
    expect(existsSync(secretsPath())).toBe(true);
  });

  it("completes an interrupted file->keyring migration at startup (keyring reconciliation)", async () => {
    // config says keyring, but a crash left a literal key in secrets.json.
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: "stranded-literal-key" } });
    keyring.readKeyringSecret.mockImplementation((key: string) => {
      if (key === "api_key_gemini") return { ok: true, value: "stranded-literal-key" };
      return { ok: true, value: null };
    });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith(
      "api_key_gemini",
      "stranded-literal-key",
    );
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "stranded-literal-key" });
    await expectFileMissingEventually(secretsPath());
  });

  it("finalizes orphaned keyring entries at startup when in file mode (keyring->file reconciliation)", async () => {
    // config says file with the secret in secrets.json, but a crash left a stale keyring
    // entry from an interrupted keyring->file migration.
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    keyring.readKeyringSecret.mockImplementation((key: string) => {
      if (key === "api_key_gemini") return { ok: true, value: "stale-keyring-key" };
      return { ok: true, value: null };
    });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it.each([
    "",
    "   ",
  ])("preserves a keyring credential when explicit file storage contains opaque literal %j", async (emptyLiteral) => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: emptyLiteral } });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    await Promise.resolve();

    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(readJson(secretsPath())).toEqual({ providers: { gemini: emptyLiteral } });
  });

  it("preserves an unknown-ref-kind secret and keeps secrets.json during keyring-mode reconciliation (T-03)", async () => {
    // secrets.json holds a stranded literal (crash leftover) AND an entry whose ref kind
    // this binary does not recognize; the literal moves to the keyring, the unknown entry
    // must round-trip in the file, not be deleted.
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), {
      providers: {
        gemini: "stranded-literal-key",
        zai: { kind: "vault", ref: "secret/data/zai#key" },
      },
    });
    keyring.readKeyringSecret.mockImplementation((key: string) => {
      if (key === "api_key_gemini") return { ok: true, value: "stranded-literal-key" };
      return { ok: true, value: null };
    });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith(
      "api_key_gemini",
      "stranded-literal-key",
    );
    // The reconcile rewrite is fire-and-forget; wait until the literal is dropped.
    const persisted = await vi.waitFor(
      () => {
        const data = readJson<{ providers: Record<string, unknown> }>(secretsPath());
        if (data.providers.gemini !== undefined) {
          throw new Error("reconcile rewrite has not removed the literal yet");
        }
        return data;
      },
      { timeout: 1000, interval: 10 },
    );
    expect(persisted.providers.zai).toEqual({ kind: "vault", ref: "secret/data/zai#key" });
    expect(existsSync(secretsPath())).toBe(true);
  });

  it("preserves an unknown-ref-kind secret across a file->keyring storage migration (T-03)", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), {
      providers: {
        gemini: "file-key",
        zai: { kind: "vault", ref: "secret/data/zai#key" },
      },
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "file-key" });
    const store = await loadStore();

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: true });
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "file-key");
    const persisted = await readJsonEventually<{ providers: Record<string, unknown> }>(
      secretsPath(),
    );
    expect(persisted.providers.zai).toEqual({ kind: "vault", ref: "secret/data/zai#key" });
    expect(persisted.providers.gemini).toBeUndefined();
  });

  it("preserves an unknown-ref-kind secret across a keyring->file storage migration (T-03)", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), {
      providers: { zai: { kind: "vault", ref: "secret/data/zai#key" } },
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });
    const store = await loadStore();

    const result = await store.updateSettings({ secretsStorage: "file" });

    expect(result).toMatchObject({ ok: true });
    const persisted = await readJsonEventually<{ providers: Record<string, unknown> }>(
      secretsPath(),
    );
    expect(persisted.providers.gemini).toBe("keyring-key");
    expect(persisted.providers.zai).toEqual({ kind: "vault", ref: "secret/data/zai#key" });
  });
});
