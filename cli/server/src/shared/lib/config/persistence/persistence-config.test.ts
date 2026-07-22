import { readdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { homePath, readJson, tempHome, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

describe("config persistence", () => {
  it("loads default config when no file exists", async () => {
    const { loadConfig, DEFAULT_PROVIDERS, DEFAULT_SETTINGS } = await import("./config.js");

    expect(loadConfig()).toEqual({
      settings: DEFAULT_SETTINGS,
      providers: DEFAULT_PROVIDERS,
    });
  });

  it("merges stored config with defaults", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    const { loadConfig, DEFAULT_SETTINGS } = await import("./config.js");

    const config = loadConfig();

    expect(config.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
    expect(config.providers.find((provider) => provider.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
  });

  it("keeps valid settings when the providers shape is malformed without quarantining", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark" },
      providers: { gemini: { hasApiKey: true } },
    });
    const { loadConfig, DEFAULT_SETTINGS, DEFAULT_PROVIDERS } = await import("./config.js");

    expect(loadConfig()).toEqual({
      settings: { ...DEFAULT_SETTINGS, theme: "dark" },
      providers: DEFAULT_PROVIDERS,
    });

    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(false);
  });

  it("loads an unknown provider id and unknown settings without quarantine, re-emitting them on persist", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark", defaultLenses: ["correctness", "made-up-lens"] },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        { provider: "future-provider", hasApiKey: true, isActive: false },
      ],
    });
    const { loadConfig, persistConfig, DEFAULT_SETTINGS } = await import("./config.js");

    const config = loadConfig();
    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(false);
    expect(config.providers.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    expect(config.settings.defaultLenses).toEqual(DEFAULT_SETTINGS.defaultLenses);
    expect(config.settings.theme).toBe("dark");

    persistConfig(config);
    const persisted = await readJson<{ providers: Array<{ provider: string }> }>(
      homePath("config.json"),
    );
    expect(persisted.providers.some((p) => p.provider === "future-provider")).toBe(true);
  });

  it("quarantines a JSON-corrupt config.json and returns defaults", async () => {
    await writeFile(homePath("config.json"), "{not json", "utf-8");
    const { loadConfig, DEFAULT_PROVIDERS, DEFAULT_SETTINGS } = await import("./config.js");

    expect(loadConfig()).toEqual({
      settings: DEFAULT_SETTINGS,
      providers: DEFAULT_PROVIDERS,
    });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(true);
  });

  it.each([
    { invalidRoot: null, label: "null config root" },
    { invalidRoot: ["invalid"], label: "array config root" },
  ])("quarantines a $label and preserves its backup after a normal persist", async ({
    invalidRoot,
  }) => {
    await writeJson("config.json", invalidRoot);
    const filePath = homePath("config.json");
    const original = await readFile(filePath, "utf-8");
    const { loadConfig, persistConfig } = await import("./config.js");

    persistConfig(loadConfig());

    const backupName = (await readdir(tempHome)).find((candidate) =>
      /^config\.json\..+\.backup$/.test(candidate),
    );
    expect(backupName).toBeDefined();
    if (!backupName) return;
    await expect(readFile(homePath(backupName), "utf-8")).resolves.toBe(original);
    await expect(readFile(filePath, "utf-8")).resolves.not.toBe(original);
  });

  it("treats a changed active provider as one aggregate choice during merge", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await import("./config.js");
    const previousProviders = loadConfig().providers;
    const inMemory = {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) =>
        provider.provider === "gemini"
          ? { ...provider, hasApiKey: true, isActive: true }
          : { ...provider },
      ),
    };

    const disk = loadConfig();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: disk.providers.map((provider) =>
        provider.provider === "openrouter"
          ? { ...provider, hasApiKey: true, isActive: true, model: "or/model" }
          : { ...provider },
      ),
    });

    await persistConfigMergedAsync(inMemory, previousProviders, DEFAULT_SETTINGS);

    const persisted = await readJson<{
      providers: Array<{ provider: string; isActive: boolean; model?: string }>;
    }>(homePath("config.json"));
    expect(persisted.providers.find((p) => p.provider === "openrouter")).toMatchObject({
      isActive: false,
      model: "or/model",
    });
    expect(persisted.providers.find((p) => p.provider === "gemini")).toMatchObject({
      isActive: true,
    });
    expect(persisted.providers.filter((provider) => provider.isActive)).toHaveLength(1);
  });

  it("keeps a concurrent active-provider choice while merging an unrelated model update", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "old-model" },
        { provider: "openrouter", hasApiKey: true, isActive: false, model: "or/model" },
      ],
    });
    const previousProviders = loadConfig().providers;
    const inMemory = {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) =>
        provider.provider === "gemini" ? { ...provider, model: "new-model" } : { ...provider },
      ),
    };

    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) => ({
        ...provider,
        isActive: provider.provider === "openrouter",
      })),
    });

    await persistConfigMergedAsync(inMemory, previousProviders, DEFAULT_SETTINGS);

    const persisted = await readJson<{
      providers: Array<{ provider: string; isActive: boolean; model?: string }>;
    }>(homePath("config.json"));
    expect(persisted.providers.find((provider) => provider.provider === "gemini")).toMatchObject({
      isActive: false,
      model: "new-model",
    });
    expect(persisted.providers.filter((provider) => provider.isActive)).toEqual([
      expect.objectContaining({ provider: "openrouter" }),
    ]);
  });

  it("repairs multiple active providers while loading legacy config", async () => {
    const { loadConfig, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-model" },
        { provider: "openrouter", hasApiKey: true, isActive: true, model: "openrouter-model" },
      ],
    });

    const loaded = loadConfig();

    expect(loaded.providers.filter((provider) => provider.isActive)).toHaveLength(1);
    expect(loaded.providers.find((provider) => provider.isActive)?.provider).toBe("gemini");
  });

  it("normalizes opaque and known active rows without losing opaque fields", async () => {
    const { loadConfig, persistConfig, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-model" },
        {
          provider: "future-provider",
          hasApiKey: true,
          isActive: true,
          model: "future-model",
          futureMetadata: { revision: 2 },
        },
      ],
    });

    const loaded = loadConfig();
    expect(loaded.unknownProviders).toEqual([
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        model: "future-model",
        futureMetadata: { revision: 2 },
      },
    ]);
    persistConfig(loaded);

    const persisted = await readJson<{
      providers: Array<Record<string, unknown> & { isActive?: boolean }>;
    }>(homePath("config.json"));
    expect(persisted.providers.filter((provider) => provider.isActive)).toHaveLength(1);
    expect(persisted.providers.find((provider) => provider.provider === "future-provider")).toEqual(
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        model: "future-model",
        futureMetadata: { revision: 2 },
      },
    );
  });

  it("deactivates an opaque selection when this transaction activates a known provider", async () => {
    const { loadConfig, persistConfigMergedAsync, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        {
          provider: "future-provider",
          hasApiKey: true,
          isActive: true,
          futureMetadata: { revision: 2 },
        },
      ],
    });
    const previous = loadConfig();
    const state = {
      ...previous,
      providers: previous.providers.map((provider) => ({
        ...provider,
        isActive: provider.provider === "gemini",
      })),
    };

    await persistConfigMergedAsync(state, previous.providers, previous.settings);

    const persisted = await readJson<{
      providers: Array<Record<string, unknown> & { isActive?: boolean }>;
    }>(homePath("config.json"));
    expect(persisted.providers.filter((provider) => provider.isActive)).toEqual([
      expect.objectContaining({ provider: "gemini" }),
    ]);
    expect(persisted.providers.find((provider) => provider.provider === "future-provider")).toEqual(
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        futureMetadata: { revision: 2 },
      },
    );
  });

  it("refuses to persist active known and opaque providers together", async () => {
    const { persistConfig, DEFAULT_SETTINGS } = await import("./config.js");

    expect(() =>
      persistConfig({
        settings: DEFAULT_SETTINGS,
        providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
        unknownProviders: [
          { provider: "future-provider", hasApiKey: true, isActive: true, futureField: 1 },
        ],
      }),
    ).toThrow("Config cannot persist more than one active provider");
  });

  it("canonicalizes default lenses at the persistence boundary and rejects an empty list", async () => {
    const { persistConfig, DEFAULT_SETTINGS } = await import("./config.js");
    const providers = [{ provider: "gemini" as const, hasApiKey: false, isActive: false }];

    persistConfig({
      settings: {
        ...DEFAULT_SETTINGS,
        defaultLenses: ["security", "correctness", "security", "tests", "correctness"],
      },
      providers,
    });

    const persisted = await readJson<{ settings: { defaultLenses: string[] } }>(
      homePath("config.json"),
    );
    expect(persisted.settings.defaultLenses).toEqual(["security", "correctness", "tests"]);

    expect(() =>
      persistConfig({
        settings: { ...DEFAULT_SETTINGS, defaultLenses: [] },
        providers,
      }),
    ).toThrow();
  });

  it("repairs an empty persisted default lens list with the non-empty default", async () => {
    const { loadConfig, DEFAULT_SETTINGS } = await import("./config.js");
    await writeJson("config.json", {
      settings: { ...DEFAULT_SETTINGS, defaultLenses: [] },
      providers: [],
    });

    expect(loadConfig().settings.defaultLenses).toEqual(DEFAULT_SETTINGS.defaultLenses);
  });

  it("merges config.json settings at per-field granularity so a concurrent change to a different settings field survives persist", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await import("./config.js");
    const previousSettings = loadConfig().settings;
    const inMemory = {
      settings: { ...previousSettings, theme: "dark" as const },
      providers: loadConfig().providers,
    };

    await writeJson("config.json", {
      settings: { ...DEFAULT_SETTINGS, severityThreshold: "high" },
      providers: loadConfig().providers,
    });

    await persistConfigMergedAsync(inMemory, inMemory.providers, previousSettings);

    const persisted = await readJson<{
      settings: { theme: string; severityThreshold: string };
    }>(homePath("config.json"));
    expect(persisted.settings.severityThreshold).toBe("high");
    expect(persisted.settings.theme).toBe("dark");
  });

  it("persists config as a real JSON file", async () => {
    const { persistConfig, DEFAULT_SETTINGS } = await import("./config.js");

    persistConfig({ settings: DEFAULT_SETTINGS, providers: [] });

    await expect(readJson(homePath("config.json"))).resolves.toEqual({
      settings: DEFAULT_SETTINGS,
      providers: [],
    });
  });
});
