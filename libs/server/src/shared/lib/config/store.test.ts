import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockReadJsonFileSync, mockWriteJsonFileSync, mockRemoveFileSync, mockWriteJsonFile, mockReadJsonFile, mockIsKeyringAvailable, mockReadKeyringSecret, mockWriteKeyringSecret, mockDeleteKeyringSecret } = vi.hoisted(() => ({
  mockReadJsonFileSync: vi.fn(),
  mockWriteJsonFileSync: vi.fn(),
  mockRemoveFileSync: vi.fn(),
  mockWriteJsonFile: vi.fn(),
  mockReadJsonFile: vi.fn(),
  mockIsKeyringAvailable: vi.fn(),
  mockReadKeyringSecret: vi.fn(),
  mockWriteKeyringSecret: vi.fn(),
  mockDeleteKeyringSecret: vi.fn(),
}));

vi.mock("../fs.js", () => ({
  readJsonFileSync: mockReadJsonFileSync,
  writeJsonFileSync: mockWriteJsonFileSync,
  removeFileSync: mockRemoveFileSync,
  writeJsonFile: mockWriteJsonFile,
  readJsonFile: mockReadJsonFile,
}));

vi.mock("./keyring.js", () => ({
  isKeyringAvailable: mockIsKeyringAvailable,
  readKeyringSecret: mockReadKeyringSecret,
  writeKeyringSecret: mockWriteKeyringSecret,
  deleteKeyringSecret: mockDeleteKeyringSecret,
}));

// Helper: setup default mocks so module init succeeds
function setupDefaults() {
  mockReadJsonFileSync.mockReturnValue(null);
  mockWriteJsonFileSync.mockReturnValue(undefined);
  mockRemoveFileSync.mockReturnValue(false);
  mockWriteJsonFile.mockResolvedValue(undefined);
  mockReadJsonFile.mockResolvedValue(null);
  mockIsKeyringAvailable.mockReturnValue(true);
}

async function loadStore() {
  const mod = await import("./store.js");
  return mod;
}

describe("config store", () => {
  beforeEach(() => {
    process.env.DIFFGAZER_HOME = "/tmp/diffgazer-test";
    vi.resetAllMocks();
    vi.resetModules();
    setupDefaults();
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
  });

  describe("getProviders", () => {
    it("should return all default providers when no config exists", async () => {
      const store = await loadStore();

      const providers = store.getProviders();

      expect(providers.length).toBeGreaterThanOrEqual(4);
      expect(providers.every((p) => p.hasApiKey === false)).toBe(true);
    });

    it("should mark providers with file-based secrets as having API key", async () => {
      mockReadJsonFileSync
        .mockReturnValueOnce(null) // config
        .mockReturnValueOnce({ providers: { gemini: "test-key" } }) // secrets
        .mockReturnValueOnce(null); // trust
      const store = await loadStore();

      const providers = store.getProviders();
      const gemini = providers.find((p) => p.provider === "gemini");

      expect(gemini?.hasApiKey).toBe(true);
    });
  });

  describe("getActiveProvider", () => {
    it("should return null when no provider is active", async () => {
      const store = await loadStore();

      expect(store.getActiveProvider()).toBeNull();
    });

    it("should return the active provider", async () => {
      mockReadJsonFileSync.mockReturnValueOnce({
        settings: {},
        providers: [
          { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        ],
      });
      const store = await loadStore();

      const active = store.getActiveProvider();

      expect(active).not.toBeNull();
      expect(active?.provider).toBe("gemini");
      expect(active?.isActive).toBe(true);
    });
  });

  describe("getSettings / updateSettings", () => {
    it("should return default settings initially", async () => {
      const store = await loadStore();

      const settings = store.getSettings();

      expect(settings.theme).toBe("auto");
      expect(settings.secretsStorage).toBeNull();
    });

    it("should update settings and persist", async () => {
      const store = await loadStore();

      const result = store.updateSettings({ theme: "dark" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.theme).toBe("dark");
      }
      expect(mockWriteJsonFile).toHaveBeenCalled();
    });
  });

  describe("saveProviderCredentials", () => {
    it("should save API key to file secrets by default", async () => {
      const store = await loadStore();

      const result = store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "new-key",
        model: "gemini-2.5-flash",
      });

      expect(result.ok).toBe(true);
      // Should persist secrets (writeJsonFile async for secrets file)
      expect(mockWriteJsonFile).toHaveBeenCalled();
    });

    it("should activate provider when model is provided", async () => {
      const store = await loadStore();

      store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "new-key",
        model: "gemini-2.5-flash",
      });

      const active = store.getActiveProvider();
      expect(active?.provider).toBe("gemini");
      expect(active?.model).toBe("gemini-2.5-flash");
    });

    it("should not activate provider when model is omitted", async () => {
      const store = await loadStore();

      store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "new-key",
      });

      const gemini = store.getProviders().find((p) => p.provider === "gemini");
      expect(gemini?.hasApiKey).toBe(true);
      // Provider without a model should not be active
      expect(gemini?.isActive).toBe(false);
    });

    it("should save to keyring when secretsStorage is keyring", async () => {
      mockReadJsonFileSync.mockReturnValueOnce({
        settings: { secretsStorage: "keyring" },
        providers: [],
      });
      mockWriteKeyringSecret.mockReturnValue({ ok: true, value: undefined });
      const store = await loadStore();

      const result = store.saveProviderCredentials({
        provider: "gemini",
        apiKey: "keyring-key",
        model: "gemini-2.5-flash",
      });

      expect(result.ok).toBe(true);
      expect(mockWriteKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "keyring-key");
    });
  });

  describe("deleteProviderCredentials", () => {
    it("should delete file-based secret and deactivate provider", async () => {
      mockReadJsonFileSync
        .mockReturnValueOnce({
          settings: {},
          providers: [
            { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
          ],
        })
        .mockReturnValueOnce({ providers: { gemini: "key-to-delete" } })
        .mockReturnValueOnce(null);
      const store = await loadStore();

      const result = store.deleteProviderCredentials("gemini");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
      const gemini = store.getProviders().find((p) => p.provider === "gemini");
      expect(gemini?.hasApiKey).toBe(false);
      expect(gemini?.isActive).toBe(false);
    });

    it("should still return true when provider exists but has no secret", async () => {
      const store = await loadStore();

      // gemini exists in default providers, so providerExists=true even without secret
      const result = store.deleteProviderCredentials("gemini");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe("activateProvider", () => {
    it("should return null for non-existent provider", async () => {
      const store = await loadStore();

      // first setup a provider without model
      const result = store.activateProvider({ provider: "gemini" });

      // gemini exists but has no model and none was passed
      expect(result).toBeNull();
    });

    it("should activate provider with given model", async () => {
      mockReadJsonFileSync.mockReturnValueOnce({
        settings: {},
        providers: [
          { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
        ],
      });
      const store = await loadStore();

      const result = store.activateProvider({
        provider: "gemini",
        model: "gemini-2.5-pro",
      });

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("gemini");
      expect(result?.model).toBe("gemini-2.5-pro");
    });
  });

  describe("getProviderApiKey", () => {
    it("should return API key from file secrets", async () => {
      mockReadJsonFileSync
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ providers: { gemini: "file-key" } })
        .mockReturnValueOnce(null);
      const store = await loadStore();

      const result = store.getProviderApiKey("gemini");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("file-key");
      }
    });

    it("should return null when no key exists", async () => {
      const store = await loadStore();

      const result = store.getProviderApiKey("gemini");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("should read from keyring when storage is keyring", async () => {
      mockReadJsonFileSync.mockReturnValueOnce({
        settings: { secretsStorage: "keyring" },
        providers: [],
      });
      mockReadKeyringSecret.mockReturnValue({ ok: true, value: "keyring-key" });
      const store = await loadStore();

      const result = store.getProviderApiKey("gemini");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("keyring-key");
      }
      expect(mockReadKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    });
  });

  describe("trust management", () => {
    it("should return null for unknown project", async () => {
      const store = await loadStore();

      expect(store.getTrust("unknown-id")).toBeNull();
    });

    it("should save and retrieve trust config", async () => {
      const store = await loadStore();
      const trustConfig = {
        projectId: "proj-1",
        repoRoot: "/projects/test",
        trustedAt: new Date().toISOString(),
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent" as const,
      };

      store.saveTrust(trustConfig);

      expect(store.getTrust("proj-1")).toEqual(trustConfig);
      expect(mockWriteJsonFile).toHaveBeenCalled();
    });

    it("should remove trust and return true", async () => {
      mockReadJsonFileSync.mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValueOnce({
        projects: {
          "proj-1": {
            projectId: "proj-1",
            projectPath: "/test",
            capabilities: { readFiles: false, runCommands: false },
          },
        },
      });
      const store = await loadStore();

      expect(store.removeTrust("proj-1")).toBe(true);
      expect(store.getTrust("proj-1")).toBeNull();
    });

    it("should return false when removing non-existent trust", async () => {
      const store = await loadStore();

      expect(store.removeTrust("nonexistent")).toBe(false);
    });

    it("should list all trusted projects", async () => {
      mockReadJsonFileSync.mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValueOnce({
        projects: {
          "p1": { projectId: "p1", projectPath: "/a", capabilities: { readFiles: false, runCommands: false } },
          "p2": { projectId: "p2", projectPath: "/b", capabilities: { readFiles: true, runCommands: true } },
        },
      });
      const store = await loadStore();

      const projects = store.listTrustedProjects();

      expect(projects).toHaveLength(2);
    });
  });

  describe("secrets migration", () => {
    it("should migrate from file to keyring on settings update", async () => {
      mockReadJsonFileSync
        .mockReturnValueOnce({ settings: { secretsStorage: "file" }, providers: [] })
        .mockReturnValueOnce({ providers: { gemini: "file-key" } })
        .mockReturnValueOnce(null);
      mockWriteKeyringSecret.mockReturnValue({ ok: true, value: undefined });
      const store = await loadStore();

      const result = store.updateSettings({ secretsStorage: "keyring" });

      expect(result.ok).toBe(true);
      expect(mockWriteKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "file-key");
      expect(mockRemoveFileSync).toHaveBeenCalled();
    });

    it("should return error when keyring is unavailable during migration", async () => {
      mockReadJsonFileSync
        .mockReturnValueOnce({ settings: { secretsStorage: "file" }, providers: [] })
        .mockReturnValueOnce({ providers: { gemini: "file-key" } })
        .mockReturnValueOnce(null);
      mockIsKeyringAvailable.mockReturnValue(false);
      const store = await loadStore();

      const result = store.updateSettings({ secretsStorage: "keyring" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
      }
    });
  });
});
