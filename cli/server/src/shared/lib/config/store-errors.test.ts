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
  it("rolls back updateSettings when config persistence fails", async () => {
    writeJson(configPath(), { settings: { theme: "auto" }, providers: [] });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("config.json")) {
        throw new Error("Injected config.json write failure");
      }
    };

    const result = await store.updateSettings({ theme: "dark" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(store.getSettings().theme).toBe("auto");
  });

  it("rolls back activateProvider when config persistence fails", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "gemini-key" } });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("config.json")) {
        throw new Error("Injected config.json write failure");
      }
    };

    const result = await store.activateProvider({ provider: "gemini", model: "gemini-2.5-pro" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(store.getProviders().find((p) => p.provider === "gemini")).toMatchObject({
      isActive: false,
      model: "gemini-2.5-flash",
    });
    expect(store.getActiveProvider()).toBeNull();
  });

  it("scrubs the absolute config path from client-facing persist errors", async () => {
    writeJson(configPath(), { settings: { theme: "auto" }, providers: [] });
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("config.json")) {
        throw new Error(`EACCES: permission denied, open '${configPath()}'`);
      }
    };

    const result = await store.updateSettings({ theme: "dark" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PERSIST_FAILED");
    expect(result.error.message).toBe("Failed to persist config");
    expect(result.error.message).not.toContain(diffgazerHome);
    expect(result.error.message).not.toContain("config.json");
  });

  it("scrubs the absolute secrets path from client-facing persist errors", async () => {
    const store = await loadStore();
    await store.updateSettings({ secretsStorage: "file" });
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath.endsWith("secrets.json")) {
        throw new Error(`ENOSPC: no space left on device, write '${secretsPath()}'`);
      }
      writeJson(filePath, data);
    };

    try {
      const result = await store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "new-key",
        model: "gemini-2.5-flash",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("PERSIST_FAILED");
      expect(result.error.message).toBe("Failed to persist secrets");
      expect(result.error.message).not.toContain(diffgazerHome);
      expect(result.error.message).not.toContain("secrets.json");
    } finally {
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("deletes the shadowed keyring literal when a provider switches to an env credential", async () => {
    process.env.GOOGLE_API_KEY = "env-key";
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "old-literal-key" });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });
    const store = await loadStore();

    try {
      const result = await store.saveProviderCredentials({
        provider: "gemini",
        apiKey: { kind: "env", varName: "GOOGLE_API_KEY" },
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({ ok: true });
      expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
      const persisted = await readJsonEventually<{ providers: Record<string, unknown> }>(
        secretsPath(),
      );
      expect(persisted.providers.gemini).toEqual({ kind: "env", varName: "GOOGLE_API_KEY" });
      expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "env-key" });
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it("deletes a keyring literal shadowed by an env sidecar ref at startup", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    // secrets.json advertises an env ref, but an interrupted literal->env switch left a
    // stale literal in the keyring.
    writeJson(secretsPath(), {
      providers: { gemini: { kind: "env", varName: "GOOGLE_API_KEY" } },
    });
    keyring.readKeyringSecret.mockImplementation((key: string) =>
      key === "api_key_gemini" ? { ok: true, value: "stale-literal" } : { ok: true, value: null },
    );
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });

    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });

    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });
});
