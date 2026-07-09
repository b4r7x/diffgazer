import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

const fsHooks = vi.hoisted(() => ({
  writeJsonFileSyncHook: null as ((filePath: string, data: unknown, mode?: number) => void) | null,
  writeJsonFileHook: null as
    | ((filePath: string, data: unknown, mode?: number) => Promise<void>)
    | null,
  getFileMtimeMsHook: null as ((filePath: string) => number | null) | null,
}));

// Boundary mock: canned keyring results, no real keychain.
vi.mock("./keyring.js", () => keyring);
// Boundary mock: real fs helper except for injected write/mtime failures.
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
    writeJsonFile: async (filePath: string, data: unknown, mode?: number) => {
      if (fsHooks.writeJsonFileHook) {
        return fsHooks.writeJsonFileHook(filePath, data, mode);
      }
      return real.writeJsonFile(filePath, data, mode);
    },
    getFileMtimeMs: (filePath: string) => {
      if (fsHooks.getFileMtimeMsHook) {
        return fsHooks.getFileMtimeMsHook(filePath);
      }
      return real.getFileMtimeMs(filePath);
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
  const { getStore } = await import("./store.js");
  return getStore();
}

async function loadStoreFactory() {
  const { createConfigStore } = await import("./store.js");
  return createConfigStore;
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
    // Suppress fire-and-forget persistence warnings that can land after teardown's rmSync.
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
    fsHooks.writeJsonFileHook = null;
    fsHooks.getFileMtimeMsHook = null;
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
      // Startup shadow-reconciliation (F-105) may probe the keyring; the read path must
      // resolve the env ref from the sidecar without touching it.
      keyring.readKeyringSecret.mockClear();
      expect(store.getProviderApiKey("gemini")).toEqual({ ok: true, value: "env-key" });
      expect(keyring.readKeyringSecret).not.toHaveBeenCalledWith("api_key_gemini");
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
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

    const geminiResult = await store.activateProvider({
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
    expect(geminiResult).toMatchObject({
      ok: true,
      value: { provider: "gemini", model: "gemini-2.5-pro" },
    });
  });

  it("saves, lists, and removes trust records", async () => {
    const store = await loadStore();
    const trust = trustConfig();

    expect(store.getTrust(trust.projectId)).toBeNull();
    await store.saveTrust(trust);

    expect(store.getTrust(trust.projectId)).toEqual(trust);
    expect(store.listTrustedProjects()).toEqual([trust]);
    await expect(
      readJsonEventually<{ projects: Record<string, TrustConfig> }>(trustPath()),
    ).resolves.toMatchObject({ projects: { [trust.projectId]: trust } });

    const removeResult1 = await store.removeTrust(trust.projectId);
    expect(removeResult1).toMatchObject({ ok: true, value: true });
    const removeResult2 = await store.removeTrust(trust.projectId);
    expect(removeResult2).toMatchObject({ ok: true, value: false });
    expect(store.getTrust(trust.projectId)).toBeNull();
  });

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

  it("refreshes stale config before writing provider changes", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file", theme: "auto" },
      providers: [],
    });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.updateSettings({ theme: "dark" });
    await storeA.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
      model: "gemini-2.5-flash",
    });

    expect(readJson<{ settings: { theme: string } }>(configPath())).toMatchObject({
      settings: { theme: "dark" },
    });
  });

  it("does not resurrect deleted secrets from stale in-memory state", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    writeJson(secretsPath(), { providers: { gemini: "existing-key" } });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.deleteProviderCredentials("gemini");
    await storeA.saveProviderCredentials({
      provider: "openrouter",
      apiKey: "new-key",
      model: "openrouter/model",
    });

    expect(readJson<{ providers: Record<string, string> }>(secretsPath())).toEqual({
      providers: { openrouter: "new-key" },
    });
  });

  it("does not resurrect revoked trust from stale in-memory state", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeA.saveTrust(trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }));
    await storeB.removeTrust("proj-1");
    await storeA.saveTrust(trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }));

    expect(readJson<{ projects: Record<string, TrustConfig> }>(trustPath())).toEqual({
      projects: {
        "proj-2": trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }),
      },
    });
    expect(storeA.getTrust("proj-1")).toBeNull();
  });

  it("preserves newer trust records when another store writes later", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.saveTrust(trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }));
    await storeA.saveTrust(trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }));

    expect(readJson<{ projects: Record<string, TrustConfig> }>(trustPath())).toMatchObject({
      projects: {
        "proj-1": trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }),
        "proj-2": trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }),
      },
    });
  });

  it("preserves another instance's activation of a known provider when a stale store persists", async () => {
    // Both providers are known ids every load materializes, so the merge must reconcile
    // per provider rather than rely on absent-id appends (F-359).
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
        { provider: "openrouter", hasApiKey: true, isActive: false, model: "or/model" },
      ],
    });
    const createStore = await loadStoreFactory();
    // Pin config.json's mtime so store A's mtime-gated refresh never reloads, modeling a
    // stale instance that never observes the concurrent write (F-359 lost-update case).
    fsHooks.getFileMtimeMsHook = (filePath) => (filePath.endsWith("config.json") ? 1 : null);
    const storeA = createStore();

    // Another instance activates openrouter on disk inside store A's window.
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
        { provider: "openrouter", hasApiKey: true, isActive: true, model: "or/model" },
      ],
    });

    // Store A activates gemini from its stale state and persists its full provider array,
    // marking openrouter inactive in A's view though A never changed it.
    await storeA.activateProvider({ provider: "gemini" });

    const persisted = readJson<{
      providers: Array<{ provider: string; isActive: boolean }>;
    }>(configPath());
    // The concurrent openrouter activation (a known provider A did not change) survives.
    expect(persisted.providers.find((p) => p.provider === "openrouter")).toMatchObject({
      isActive: true,
    });
    expect(persisted.providers.find((p) => p.provider === "gemini")).toMatchObject({
      isActive: true,
    });
  });

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
      configWriteCount++;
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
      settings: {},
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
      ],
    });
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

  it("rolls back saveTrust when trust persistence fails", async () => {
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error("Injected trust.json write failure");
      }
    };

    const result = await store.saveTrust(trustConfig());

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(store.getTrust("proj-1")).toBeNull();
  });

  it("serializes concurrent mutators so the second sees the first's settled state", async () => {
    writeJson(configPath(), { settings: { theme: "auto" }, providers: [] });
    const store = await loadStore();

    const order: string[] = [];
    let releaseFirstWrite: () => void = () => {};
    const firstWriteHeld = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });

    let writeCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      writeCount += 1;
      order.push(`write:${writeCount}`);
      // Hold only the first config write open to prove the second mutation queues.
      if (writeCount === 1) await firstWriteHeld;
      writeJson(filePath, data);
    };

    const first = store.updateSettings({ theme: "dark" });
    const second = store.updateSettings({ severityThreshold: "high" });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual(["write:1"]);

    releaseFirstWrite();
    await first;
    await second;

    expect(order).toEqual(["write:1", "write:2"]);
    expect(store.getSettings()).toMatchObject({ theme: "dark", severityThreshold: "high" });
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

    await loadStore();

    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
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

    await loadStore();

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

  it("re-keys review history when a trusted project directory is moved", async () => {
    const { setReviewRekeyHandler, createConfigStore } = await import("./store.js");
    const rekeys: Array<[string, string]> = [];
    setReviewRekeyHandler((oldPath, newPath) => rekeys.push([oldPath, newPath]));

    const originalRoot = join(diffgazerHome, "original");
    const movedRoot = join(diffgazerHome, "moved");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    // A .git dir makes the path an allowed project root.
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );

    try {
      const store = createConfigStore();
      const info = store.getProjectInfo(movedRoot);

      expect(info.projectId).toBe("stable-id");
      expect(rekeys.length).toBe(1);
      expect(rekeys[0]?.[1]).toContain("moved");
    } finally {
      setReviewRekeyHandler(() => {});
    }
  });

  it("keeps exactly one trust record for a moved project's preserved projectId", async () => {
    const movedRoot = join(diffgazerHome, "moved-trust");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-trust-id",
        repoRoot: join(diffgazerHome, "gone"),
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    const store = await loadStore();

    const info = store.ensureProjectFile(movedRoot);
    await store.saveTrust(trustConfig({ projectId: info.projectId ?? "", repoRoot: movedRoot }));
    // A second re-trust under the same projectId overwrites, never minting a duplicate.
    await store.saveTrust(trustConfig({ projectId: info.projectId ?? "", repoRoot: movedRoot }));

    const records = readJson<{ projects: Record<string, unknown> }>(trustPath()).projects;
    expect(Object.keys(records)).toEqual([info.projectId]);
  });

  it("clears the persistent trust record when a project is downgraded to session trust (F-045)", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();

    await storeA.saveTrust(trustConfig({ trustMode: "persistent" }));
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toMatchObject({ trustMode: "persistent" });

    const downgrade = await storeA.saveTrust(trustConfig({ trustMode: "session" }));
    expect(downgrade).toMatchObject({ ok: true, value: { trustMode: "session" } });

    expect(storeA.getTrust("proj-1")).toMatchObject({ trustMode: "session" });
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toBeUndefined();

    // A fresh store (daemon restart) must not resurrect the persistent grant.
    const storeB = createStore();
    expect(storeB.getTrust("proj-1")).toBeNull();
  });

  it("leaves no session grant applied when a downgrade's persistent removal fails (F-045)", async () => {
    const createStore = await loadStoreFactory();
    const store = createStore();

    await store.saveTrust(trustConfig({ trustMode: "persistent" }));

    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error("EACCES: permission denied");
      }
    };

    const downgrade = await store.saveTrust(trustConfig({ trustMode: "session" }));
    fsHooks.writeJsonFileHook = null;

    expect(downgrade.ok).toBe(false);
    // A failed removal must not leave a partially-applied session grant.
    expect(store.getTrust("proj-1")).toMatchObject({ trustMode: "persistent" });
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toMatchObject({ trustMode: "persistent" });
  });

  it("scrubs the absolute config path from client-facing persist errors (F-085)", async () => {
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

  it("scrubs the absolute secrets path from client-facing persist errors (F-085)", async () => {
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

  it("scrubs the absolute trust path from client-facing persist errors (F-085)", async () => {
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error(`EACCES: permission denied, open '${trustPath()}'`);
      }
    };

    const result = await store.saveTrust(trustConfig());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PERSIST_FAILED");
    expect(result.error.message).toBe("Failed to persist trust");
    expect(result.error.message).not.toContain(diffgazerHome);
    expect(result.error.message).not.toContain("trust.json");
  });

  it("deletes the shadowed keyring literal when a provider switches to an env credential (F-105)", async () => {
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

  it("deletes a keyring literal shadowed by an env sidecar ref at startup (F-105)", async () => {
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

    await loadStore();

    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });
});
