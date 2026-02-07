import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadJsonFileSync, mockWriteJsonFileSync, mockRemoveFileSync } = vi.hoisted(() => ({
  mockReadJsonFileSync: vi.fn(),
  mockWriteJsonFileSync: vi.fn(),
  mockRemoveFileSync: vi.fn(),
}));

vi.mock("../fs.js", () => ({
  readJsonFileSync: mockReadJsonFileSync,
  writeJsonFileSync: mockWriteJsonFileSync,
  removeFileSync: mockRemoveFileSync,
}));

vi.mock("../paths.js", () => ({
  getGlobalConfigPath: () => "/mock/config.json",
  getGlobalSecretsPath: () => "/mock/secrets.json",
  getGlobalTrustPath: () => "/mock/trust.json",
  getProjectInfoPath: (root: string) => `${root}/.stargazer/project.json`,
}));

import {
  loadConfig,
  loadSecrets,
  loadTrust,
  persistConfig,
  persistSecrets,
  persistTrust,
  removeSecretsFile,
  syncProvidersWithSecrets,
  readOrCreateProjectFile,
  DEFAULT_SETTINGS,
  DEFAULT_PROVIDERS,
} from "./state.js";

describe("config state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("loadConfig", () => {
    it("should return defaults when no config file exists", () => {
      mockReadJsonFileSync.mockReturnValue(null);

      const config = loadConfig();

      expect(config.settings).toEqual(DEFAULT_SETTINGS);
      expect(config.providers).toHaveLength(DEFAULT_PROVIDERS.length);
    });

    it("should merge stored settings with defaults", () => {
      mockReadJsonFileSync.mockReturnValue({
        settings: { theme: "dark" },
        providers: [],
      });

      const config = loadConfig();

      expect(config.settings.theme).toBe("dark");
      expect(config.settings.secretsStorage).toBe(DEFAULT_SETTINGS.secretsStorage);
    });

    it("should normalize providers to include all known providers", () => {
      mockReadJsonFileSync.mockReturnValue({
        settings: {},
        providers: [
          { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        ],
      });

      const config = loadConfig();

      // Should include all default providers
      expect(config.providers.length).toBeGreaterThanOrEqual(4);
      const gemini = config.providers.find((p) => p.provider === "gemini");
      expect(gemini?.hasApiKey).toBe(true);
      expect(gemini?.isActive).toBe(true);
    });

    it("should filter out invalid provider IDs", () => {
      mockReadJsonFileSync.mockReturnValue({
        settings: {},
        providers: [
          { provider: "invalid-provider", hasApiKey: true, isActive: true },
        ],
      });

      const config = loadConfig();

      const invalid = config.providers.find((p) => p.provider === "invalid-provider");
      expect(invalid).toBeUndefined();
    });
  });

  describe("loadSecrets", () => {
    it("should return empty providers when no secrets file exists", () => {
      mockReadJsonFileSync.mockReturnValue(null);

      const secrets = loadSecrets();

      expect(secrets.providers).toEqual({});
    });

    it("should load stored secrets", () => {
      mockReadJsonFileSync.mockReturnValue({
        providers: { gemini: "key-123" },
      });

      const secrets = loadSecrets();

      expect(secrets.providers.gemini).toBe("key-123");
    });
  });

  describe("loadTrust", () => {
    it("should return empty projects when no trust file exists", () => {
      mockReadJsonFileSync.mockReturnValue(null);

      const trust = loadTrust();

      expect(trust.projects).toEqual({});
    });

    it("should normalize trust capabilities with defaults", () => {
      mockReadJsonFileSync.mockReturnValue({
        projects: {
          "proj-1": {
            projectId: "proj-1",
            projectPath: "/proj",
            capabilities: null,
          },
        },
      });

      const trust = loadTrust();

      expect(trust.projects["proj-1"]?.capabilities).toEqual({
        readFiles: false,
        runCommands: false,
      });
    });

    it("should preserve existing capability values", () => {
      mockReadJsonFileSync.mockReturnValue({
        projects: {
          "proj-1": {
            projectId: "proj-1",
            projectPath: "/proj",
            capabilities: { readFiles: true, runCommands: false },
          },
        },
      });

      const trust = loadTrust();

      expect(trust.projects["proj-1"]?.capabilities).toEqual({
        readFiles: true,
        runCommands: false,
      });
    });
  });

  describe("persistConfig", () => {
    it("should write config with 0o600 permissions", () => {
      persistConfig({ settings: DEFAULT_SETTINGS, providers: [] });

      expect(mockWriteJsonFileSync).toHaveBeenCalledWith(
        "/mock/config.json",
        { settings: DEFAULT_SETTINGS, providers: [] },
        0o600
      );
    });
  });

  describe("persistSecrets", () => {
    it("should write secrets with 0o600 permissions", () => {
      persistSecrets({ providers: { gemini: "key" } });

      expect(mockWriteJsonFileSync).toHaveBeenCalledWith(
        "/mock/secrets.json",
        { providers: { gemini: "key" } },
        0o600
      );
    });
  });

  describe("removeSecretsFile", () => {
    it("should call removeFileSync with secrets path", () => {
      mockRemoveFileSync.mockReturnValue(true);

      const result = removeSecretsFile();

      expect(result).toBe(true);
      expect(mockRemoveFileSync).toHaveBeenCalledWith("/mock/secrets.json");
    });
  });

  describe("syncProvidersWithSecrets", () => {
    it("should mark providers as having API key when secret exists", () => {
      const providers = [
        { provider: "gemini" as const, hasApiKey: false, isActive: false },
      ];
      const secrets = { providers: { gemini: "key-123" } };

      const synced = syncProvidersWithSecrets(providers, secrets, "file");

      expect(synced[0]?.hasApiKey).toBe(true);
    });

    it("should mark providers as not having API key when secret is missing", () => {
      const providers = [
        { provider: "gemini" as const, hasApiKey: true, isActive: true },
      ];
      const secrets = { providers: {} };

      const synced = syncProvidersWithSecrets(providers, secrets, "file");

      expect(synced[0]?.hasApiKey).toBe(false);
    });

    it("should pass through providers unchanged when storage is keyring", () => {
      const providers = [
        { provider: "gemini" as const, hasApiKey: false, isActive: false },
      ];
      const secrets = { providers: { gemini: "key-123" } };

      const synced = syncProvidersWithSecrets(providers, secrets, "keyring");

      expect(synced[0]?.hasApiKey).toBe(false);
    });

    it("should add providers found in secrets but not in providers list", () => {
      const providers = [
        { provider: "gemini" as const, hasApiKey: false, isActive: false },
      ];
      const secrets = { providers: { gemini: "key", zai: "key2" } };

      const synced = syncProvidersWithSecrets(providers, secrets, "file");

      const zai = synced.find((p) => p.provider === "zai");
      expect(zai).toBeDefined();
      expect(zai?.hasApiKey).toBe(true);
    });
  });

  describe("readOrCreateProjectFile", () => {
    it("should return existing project file when found", () => {
      const existing = {
        projectId: "existing-id",
        repoRoot: "/projects/foo",
        createdAt: "2024-01-01",
      };
      mockReadJsonFileSync.mockReturnValue(existing);

      const result = readOrCreateProjectFile("/projects/foo");

      expect(result.projectId).toBe("existing-id");
      expect(mockWriteJsonFileSync).not.toHaveBeenCalled();
    });

    it("should create new project file when not found", () => {
      mockReadJsonFileSync.mockReturnValue(null);

      const result = readOrCreateProjectFile("/projects/new");

      expect(result.projectId).toBeDefined();
      expect(result.repoRoot).toBe("/projects/new");
      expect(mockWriteJsonFileSync).toHaveBeenCalledWith(
        "/projects/new/.stargazer/project.json",
        expect.objectContaining({ repoRoot: "/projects/new" }),
        0o600
      );
    });
  });
});
