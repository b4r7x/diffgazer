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
  it("loads default providers and settings when no files exist", async () => {
    const store = await loadStore();

    expect(store.getSettings()).toMatchObject({
      theme: "auto",
      secretsStorage: null,
    });
    expect(store.getProviders().length).toBeGreaterThanOrEqual(4);
    expect(store.getProviders().every((provider) => !provider.hasApiKey)).toBe(true);
    expect(store.getActiveProvider()).toBeNull();
  });

  it("hydrates providers from config and file secrets on disk", async () => {
    writeJson(configPath(), {
      settings: {},
      providers: [
        { provider: "gemini", hasApiKey: false, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    const store = await loadStore();

    const gemini = store.getProviders().find((provider) => provider.provider === "gemini");
    expect(gemini).toMatchObject({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    expect(store.getActiveProvider()?.provider).toBe("gemini");
  });

  it("persists updated settings to the config file", async () => {
    const store = await loadStore();

    const result = await store.updateSettings({ theme: "dark" });

    expect(result).toMatchObject({ ok: true, value: { theme: "dark" } });
    await expect(readJsonEventually(configPath())).resolves.toMatchObject({
      settings: { theme: "dark" },
    });
  });

  it("saves file-backed provider credentials, activates the selected model, and deletes them", async () => {
    const store = await loadStore();
    await store.updateSettings({ secretsStorage: "file" });

    const saveResult = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
      model: "gemini-2.5-flash",
    });

    expect(saveResult).toMatchObject({
      ok: true,
      value: { provider: "gemini", hasApiKey: true, isActive: true },
    });
    expect(store.getActiveProvider()).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "new-key" });
    await expect(
      readJsonEventually<{ providers: Record<string, string> }>(secretsPath()),
    ).resolves.toMatchObject({ providers: { gemini: "new-key" } });

    const deleteResult = await store.deleteProviderCredentials("gemini");

    expect(deleteResult).toEqual({ ok: true, value: true });
    expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: null });
    expect(store.getProviders().find((provider) => provider.provider === "gemini")).toMatchObject({
      hasApiKey: false,
      isActive: false,
      model: undefined,
    });
    await expectFileMissingEventually(secretsPath());
  });

  it("keeps providers inactive when credentials are saved without a model", async () => {
    const store = await loadStore();
    await store.updateSettings({ secretsStorage: "file" });

    await store.saveProviderCredentials({ provider: "gemini", apiKey: "new-key" });

    expect(store.getProviders().find((provider) => provider.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: false,
    });
  });

  it("uses keyring operations when keyring storage is selected", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });
    const store = await loadStore();

    const saveResult = await store.saveProviderCredentials({
      provider: "gemini",
      apiKey: "next-key",
      model: "gemini-2.5-flash",
    });
    const readResult = store.getProviderApiKey("gemini");

    expect(saveResult).toMatchObject({ ok: true });
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "next-key");
    expect(readResult).toEqual({ ok: true, value: "keyring-key" });
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("reads env-backed credentials from the sidecar in keyring mode", async () => {
    process.env.GOOGLE_API_KEY = "env-key";
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    writeJson(secretsPath(), {
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
    });

    try {
      const store = await loadStore();
      await expect(store.ready()).resolves.toMatchObject({ ok: true });
      // Startup shadow-reconciliation may probe the keyring; the read path must
      // resolve the env ref from the sidecar without touching it.
      keyring.readKeyringSecret.mockClear();
      expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "env-key" });
      expect(keyring.readKeyringSecret).not.toHaveBeenCalledWith("api_key_gemini");
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it("does not resolve a foreign env ref loaded for a known provider", async () => {
    const foreignEnvName = "UNRELATED_PROCESS_SECRET";
    const originalForeignSecret = process.env[foreignEnvName];
    process.env[foreignEnvName] = "must-not-resolve";

    try {
      writeJson(configPath(), {
        settings: { secretsStorage: "file" },
        providers: [
          {
            provider: "openrouter",
            hasApiKey: true,
            isActive: true,
            model: "openrouter/auto",
          },
        ],
      });
      writeJson(secretsPath(), {
        providers: {
          openrouter: { kind: "env", varName: foreignEnvName },
        },
      });
      const store = await loadStore();
      await expect(store.ready()).resolves.toMatchObject({ ok: true });

      expect(store.getProviderApiKey("openrouter")).toEqual({ ok: true, value: null });
      expect(store.getProviders().find(({ provider }) => provider === "openrouter")).toMatchObject({
        hasApiKey: false,
        isActive: true,
      });
    } finally {
      if (originalForeignSecret === undefined) delete process.env[foreignEnvName];
      else process.env[foreignEnvName] = originalForeignSecret;
    }
  });

  it("activates an existing provider only when a model is known or supplied", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
        { provider: "openrouter", hasApiKey: true, isActive: false },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "gemini-key", openrouter: "router-key" } });
    const store = await loadStore();

    const openrouterResult = await store.activateProvider({ provider: "openrouter" });
    expect(openrouterResult).toMatchObject({ ok: true, value: null });

    const geminiResult = await store.activateProvider({
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
    expect(geminiResult).toMatchObject({
      ok: true,
      value: { provider: "gemini", model: "gemini-2.5-pro" },
    });
  });
});
