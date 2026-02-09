import * as path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../fs.js");

const TEST_HOME = "/tmp/diffgazer-test";

import { readJsonFileSync, writeJsonFileSync, removeFileSync } from "../fs.js";
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
    process.env.DIFFGAZER_HOME = TEST_HOME;
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
  });

  describe("loadConfig", () => {
    it("should return defaults when no config file exists", () => {
      vi.mocked(readJsonFileSync).mockReturnValue(null);

      const config = loadConfig();

      expect(config.settings).toEqual(DEFAULT_SETTINGS);
      expect(config.providers).toHaveLength(DEFAULT_PROVIDERS.length);
    });

    it("should merge stored settings with defaults", () => {
      vi.mocked(readJsonFileSync).mockReturnValue({
        settings: { theme: "dark" },
        providers: [],
      });

      const config = loadConfig();

      expect(config.settings.theme).toBe("dark");
      expect(config.settings.secretsStorage).toBe(DEFAULT_SETTINGS.secretsStorage);
    });

    it("should normalize providers to include all known providers", () => {
      vi.mocked(readJsonFileSync).mockReturnValue({
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
      vi.mocked(readJsonFileSync).mockReturnValue({
        settings: {},
        providers: [
          { provider: "invalid-provider", hasApiKey: true, isActive: true },
        ],
      });

      const config = loadConfig();

      const invalid = config.providers.find((p) => p.provider === ("invalid-provider" as string));
      expect(invalid).toBeUndefined();
    });
  });

  describe("loadSecrets", () => {
    it("should return empty providers when no secrets file exists", () => {
      vi.mocked(readJsonFileSync).mockReturnValue(null);

      const secrets = loadSecrets();

      expect(secrets.providers).toEqual({});
    });

    it("should load stored secrets", () => {
      vi.mocked(readJsonFileSync).mockReturnValue({
        providers: { gemini: "key-123" },
      });

      const secrets = loadSecrets();

      expect(secrets.providers.gemini).toBe("key-123");
    });
  });

  describe("loadTrust", () => {
    it("should return empty projects when no trust file exists", () => {
      vi.mocked(readJsonFileSync).mockReturnValue(null);

      const trust = loadTrust();

      expect(trust.projects).toEqual({});
    });

    it("should normalize trust capabilities with defaults", () => {
      vi.mocked(readJsonFileSync).mockReturnValue({
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
      vi.mocked(readJsonFileSync).mockReturnValue({
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

      expect(vi.mocked(writeJsonFileSync)).toHaveBeenCalledWith(
        path.join(TEST_HOME, "config.json"),
        { settings: DEFAULT_SETTINGS, providers: [] },
        0o600
      );
    });
  });

  describe("persistSecrets", () => {
    it("should write secrets with 0o600 permissions", () => {
      persistSecrets({ providers: { gemini: "key" } });

      expect(vi.mocked(writeJsonFileSync)).toHaveBeenCalledWith(
        path.join(TEST_HOME, "secrets.json"),
        { providers: { gemini: "key" } },
        0o600
      );
    });
  });

  describe("removeSecretsFile", () => {
    it("should call removeFileSync with secrets path", () => {
      vi.mocked(removeFileSync).mockReturnValue(true);

      const result = removeSecretsFile();

      expect(result).toBe(true);
      expect(vi.mocked(removeFileSync)).toHaveBeenCalledWith(path.join(TEST_HOME, "secrets.json"));
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
      vi.mocked(readJsonFileSync).mockReturnValue(existing);

      const result = readOrCreateProjectFile("/projects/foo");

      expect(result.projectId).toBe("existing-id");
      expect(vi.mocked(writeJsonFileSync)).not.toHaveBeenCalled();
    });

    it("should create new project file when not found", () => {
      vi.mocked(readJsonFileSync).mockReturnValue(null);

      const result = readOrCreateProjectFile("/projects/new");

      expect(result.projectId).toBeDefined();
      expect(result.repoRoot).toBe("/projects/new");
      expect(vi.mocked(writeJsonFileSync)).toHaveBeenCalledWith(
        "/projects/new/.diffgazer/project.json",
        expect.objectContaining({ repoRoot: "/projects/new" }),
        0o600
      );
    });
  });
});
