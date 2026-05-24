import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustConfig } from "@diffgazer/core/schemas/config";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

const fsHooks = vi.hoisted(() => ({
  writeJsonFileSyncHook: null as ((filePath: string, data: unknown, mode?: number) => void) | null,
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results so store behavior can be exercised without a real keychain.
vi.mock("./keyring.js", () => keyring);
// Partial mock: intercept writeJsonFileSync so individual tests can inject write failures.
vi.mock("../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fs.js")>();
  return {
    ...real,
    writeJsonFileSync: (filePath: string, data: unknown, mode?: number) => {
      if (fsHooks.writeJsonFileSyncHook) {
        return fsHooks.writeJsonFileSyncHook(filePath, data, mode);
      }
      return real.writeJsonFileSync(filePath, data, mode);
    },
  };
});

let diffgazerHome: string;

const configPath = (): string => join(diffgazerHome, "config.json");
const secretsPath = (): string => join(diffgazerHome, "secrets.json");
const trustPath = (): string => join(diffgazerHome, "trust.json");

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

async function readJsonEventually<T>(filePath: string): Promise<T> {
  return vi.waitFor(
    () => {
      if (!existsSync(filePath)) throw new Error(`Expected ${filePath} to exist`);
      return readJson<T>(filePath);
    },
    { timeout: 1000, interval: 10 },
  );
}

async function expectFileMissingEventually(filePath: string): Promise<void> {
  await vi.waitFor(
    () => {
      if (existsSync(filePath)) throw new Error(`Expected ${filePath} to be absent`);
    },
    { timeout: 1000, interval: 10 },
  );
}

async function loadStore() {
  return import("./store.js");
}

function trustConfig(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId: "proj-1",
    repoRoot: "/projects/test",
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

describe("config store", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-store-"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    // Suppress fire-and-forget persistence warnings emitted after teardown removes the temp dir.
    // The store dispatches persistConfigAsync/persistSecretsAsync/persistTrustAsync without awaiting,
    // so a pending write can land after rmSync; production keeps this UX-friendly fire-and-forget pattern.
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    vi.clearAllMocks();
    keyring.isKeyringAvailable.mockReturnValue(true);
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(() => {
    fsHooks.writeJsonFileSyncHook = null;
    delete process.env.DIFFGAZER_HOME;
    rmSync(diffgazerHome, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

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
    await expect(readJsonEventually<{ providers: Record<string, string> }>(secretsPath()))
      .resolves.toMatchObject({ providers: { gemini: "new-key" } });

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

  it("activates an existing provider only when a model is known or supplied", async () => {
    writeJson(configPath(), {
      settings: {},
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
        { provider: "openrouter", hasApiKey: true, isActive: false },
      ],
    });
    const store = await loadStore();

    const openrouterResult = await store.activateProvider({ provider: "openrouter" });
    expect(openrouterResult).toMatchObject({ ok: true, value: null });

    const geminiResult = await store.activateProvider({ provider: "gemini", model: "gemini-2.5-pro" });
    expect(geminiResult).toMatchObject({ ok: true, value: { provider: "gemini", model: "gemini-2.5-pro" } });
  });

  it("saves, lists, and removes trust records", async () => {
    const store = await loadStore();
    const trust = trustConfig();

    expect(store.getTrust(trust.projectId)).toBeNull();
    await store.saveTrust(trust);

    expect(store.getTrust(trust.projectId)).toEqual(trust);
    expect(store.listTrustedProjects()).toEqual([trust]);
    await expect(readJsonEventually<{ projects: Record<string, TrustConfig> }>(trustPath()))
      .resolves.toMatchObject({ projects: { [trust.projectId]: trust } });

    const removeResult1 = await store.removeTrust(trust.projectId);
    expect(removeResult1).toMatchObject({ ok: true, value: true });
    const removeResult2 = await store.removeTrust(trust.projectId);
    expect(removeResult2).toMatchObject({ ok: true, value: false });
    expect(store.getTrust(trust.projectId)).toBeNull();
  });

  it("migrates file secrets to keyring and removes the file secrets store", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), { providers: { gemini: "file-key" } });
    // Read-back verification: return the written value so the migration succeeds.
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "file-key" });
    const store = await loadStore();

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: true });
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "file-key");
    // Verification: the migration reads back the written value to confirm the keyring persisted it.
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    await expectFileMissingEventually(secretsPath());
  });

  it("persists the file copy BEFORE deleting keyring entries when migrating keyring->file (crash-safety)", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });

    // Record the order in which the file write and keyring delete happen.
    const events: string[] = [];
    keyring.deleteKeyringSecret.mockImplementation(() => {
      events.push(`delete:${existsSync(secretsPath()) ? "file-exists" : "file-missing"}`);
      return { ok: true, value: true };
    });

    const store = await loadStore();
    const result = await store.updateSettings({ secretsStorage: "file" });

    expect(result).toMatchObject({ ok: true });
    // When deleteKeyringSecret was invoked, the file already existed.
    expect(events).toEqual(["delete:file-exists"]);
    // And the file holds the migrated secret -- a crash anywhere AFTER persist
    // and BEFORE finalizeKeyringDeletions leaves the secret safely on disk.
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

    // Inject a deterministic write failure: hook writeJsonFileSync to throw only
    // when persisting secrets.json. The config.json persist (step 1 of the
    // two-phase migration) has already succeeded by the time secrets are written,
    // so this selectively breaks step 2 without affecting step 1.
    let configWriteCount = 0;
    fsHooks.writeJsonFileSyncHook = (filePath: string, data: unknown, mode?: number) => {
      if (filePath.endsWith("secrets.json")) {
        throw new Error("Injected secrets.json write failure");
      }
      // Allow config.json writes through to the real implementation.
      configWriteCount++;
      writeJson(filePath, data);
    };

    try {
      await expect(store.updateSettings({ secretsStorage: "file" })).rejects.toThrow(
        "Injected secrets.json write failure",
      );

      // Config.json was written successfully (step 1 completed).
      expect(configWriteCount).toBeGreaterThanOrEqual(1);
      // The keyring entry must NOT have been deleted — the file persist failed
      // before the cleanup phase, so the secret is still safely in the keyring.
      expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
      // No secrets.json should exist — the write was interrupted.
      expect(existsSync(secretsPath())).toBe(false);
    } finally {
      fsHooks.writeJsonFileSyncHook = null;
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
});
