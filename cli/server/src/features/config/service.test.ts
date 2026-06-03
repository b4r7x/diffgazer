import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProvider, TrustConfig } from "@diffgazer/core/schemas/config";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

const openRouter = vi.hoisted(() => ({
  getOpenRouterModelsWithCache: vi.fn(),
}));

const catalog = vi.hoisted(() => ({ getProviderModels: vi.fn() }));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../../shared/lib/config/keyring.js", () => keyring);
// Boundary mock: openrouter-models wraps the OpenRouter HTTP API (network boundary); tests provide canned model list responses so service behavior can be exercised offline.
vi.mock("../../shared/lib/ai/openrouter-models.js", () => openRouter);
// Boundary mock: models-dev-catalog wraps the models.dev HTTP API + disk cache.
vi.mock("../../shared/lib/ai/models-dev-catalog.js", () => catalog);

let diffgazerHome: string;
let projectRoot: string;

const configPath = (): string => join(diffgazerHome, "config.json");

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadService() {
  return import("./service.js");
}

async function loadStore() {
  const { getStore } = await import("../../shared/lib/config/store.js");
  return getStore();
}

async function configureProvider(
  provider: AIProvider,
  options: { apiKey?: string; model?: string } = {},
) {
  const store = await loadStore();
  await store.updateSettings({ secretsStorage: "file" });
  await store.saveProviderCredentials({
    provider,
    apiKey: options.apiKey ?? "sk-test",
    model: options.model,
  });
  return store;
}

function trustConfig(projectId: string, overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

describe("config service", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-service-home-"));
    projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-service-project-"));
    mkdirSync(join(projectRoot, ".git"));
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
    delete process.env.DIFFGAZER_HOME;
    rmSync(diffgazerHome, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it("reports providers and the active provider from the real store", async () => {
    await configureProvider("gemini", { model: "gemini-2.5-flash" });
    const { getProvidersStatus } = await loadService();

    const status = getProvidersStatus();

    expect(status.activeProvider).toBe("gemini");
    expect(status.providers.find((provider) => provider.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
  });

  it("reports configured only when an active provider has a stored API key", async () => {
    const { checkConfig } = await loadService();

    expect(checkConfig()).toMatchObject({ ok: true, value: { configured: false } });

    const store = await configureProvider("gemini", { model: "gemini-2.5-flash" });
    expect(checkConfig()).toMatchObject({
      ok: true,
      value: {
        configured: true,
        config: { provider: "gemini", model: "gemini-2.5-flash" },
      },
    });

    await store.deleteProviderCredentials("gemini");
    expect(checkConfig()).toMatchObject({ ok: true, value: { configured: false } });
  });

  it("propagates secret storage errors from the store", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_READ_FAILED", message: "fail" },
    });
    const { checkConfig } = await loadService();

    expect(checkConfig()).toMatchObject({
      ok: false,
      error: { code: "KEYRING_READ_FAILED" },
    });
  });

  it("activates providers using the store's model requirements", async () => {
    const { activateProvider } = await loadService();

    expect(await activateProvider({ provider: "gemini" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_BODY" },
    });

    await configureProvider("gemini", { model: "gemini-2.5-flash" });
    catalog.getProviderModels.mockResolvedValue({
      models: [
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "", tier: "paid" },
      ],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });
    expect(await activateProvider({ provider: "gemini", model: "gemini-2.5-pro" }))
      .toMatchObject({
        ok: true,
        value: { provider: "gemini", model: "gemini-2.5-pro" },
      });

    expect(await activateProvider({ provider: "unknown" as AIProvider, model: "m1" }))
      .toMatchObject({
        ok: false,
        error: { code: "PROVIDER_NOT_FOUND" },
      });
  });

  it("rejects a model that is absent from the provider's catalog with MODEL_ERROR", async () => {
    await configureProvider("gemini", { model: "gemini-2.5-flash" });
    catalog.getProviderModels.mockResolvedValue({
      models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" }],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });
    const { activateProvider } = await loadService();

    const result = await activateProvider({ provider: "gemini", model: "totally-fake-model-xyz" });

    expect(catalog.getProviderModels).toHaveBeenCalledWith("gemini");
    expect(result).toMatchObject({ ok: false, error: { code: "MODEL_ERROR" } });
    expect(result.ok === false && result.error.message).toContain("totally-fake-model-xyz");
    expect(result.ok === false && result.error.message).toContain("gemini");
  });

  it("exempts openrouter from catalog membership validation", async () => {
    await configureProvider("openrouter", { apiKey: "sk-openrouter", model: "some-router-model" });
    const { activateProvider } = await loadService();

    const result = await activateProvider({ provider: "openrouter", model: "any/router-model:free" });

    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      value: { provider: "openrouter", model: "any/router-model:free" },
    });
  });

  it("blocks activation when the provider's API key read fails", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: false, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_READ_FAILED", message: "keychain locked" },
    });
    const { activateProvider } = await loadService();

    const result = await activateProvider({ provider: "gemini", model: "gemini-2.5-flash" });

    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_BODY" } });
  });

  it("fetches OpenRouter models with the stored OpenRouter API key", async () => {
    await configureProvider("openrouter", { apiKey: "sk-openrouter" });
    openRouter.getOpenRouterModelsWithCache.mockResolvedValue({
      ok: true,
      value: {
        models: [{ id: "model-1", name: "M1" }],
        fetchedAt: "2024-01-01",
        cached: false,
      },
    });
    const { getOpenRouterModels } = await loadService();

    const result = await getOpenRouterModels();

    expect(openRouter.getOpenRouterModelsWithCache).toHaveBeenCalledWith("sk-openrouter");
    expect(result).toMatchObject({
      ok: true,
      value: { models: [{ id: "model-1", name: "M1" }] },
    });
  });

  it("returns OpenRouter errors when the key is missing or the model request fails", async () => {
    const { getOpenRouterModels } = await loadService();

    expect(await getOpenRouterModels()).toMatchObject({
      ok: false,
      error: { code: "API_KEY_MISSING" },
    });

    await configureProvider("openrouter", { apiKey: "sk-openrouter" });
    openRouter.getOpenRouterModelsWithCache.mockResolvedValue({
      ok: false,
      error: { message: "network error" },
    });

    expect(await getOpenRouterModels()).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "network error" },
    });
  });

  it("derives setup readiness from settings, provider config, and project trust", async () => {
    const { getSetupStatus } = await loadService();

    const initial = getSetupStatus(projectRoot);
    expect(initial).toMatchObject({
      hasSecretsStorage: false,
      hasProvider: false,
      hasModel: false,
      hasTrust: false,
      isReady: false,
    });
    expect(initial.missing).toEqual(["secretsStorage", "provider", "model", "trust"]);

    const store = await configureProvider("gemini", { model: "gemini-2.5-flash" });
    const project = store.ensureProjectFile(projectRoot);
    await store.saveTrust(trustConfig(project.projectId!));

    expect(getSetupStatus(projectRoot)).toMatchObject({
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    });
  });

  it("persists config service writes through the real store", async () => {
    const store = await loadStore();
    await store.updateSettings({ secretsStorage: "file" });
    const { saveConfig } = await loadService();

    const result = await saveConfig({
      provider: "gemini",
      apiKey: "sk-123",
      model: "gemini-2.5-flash",
    });

    expect(result).toMatchObject({ ok: true, value: { provider: "gemini" } });
    await vi.waitFor(
      () => {
        expect(readFileSync(configPath(), "utf-8")).toContain("gemini-2.5-flash");
      },
      { timeout: 1000, interval: 10 },
    );
  });

  describe("credential validation", () => {
    it("rejects env credential refs whose var name is not the provider's own key", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "gemini",
        apiKey: { kind: "env", varName: "AWS_SECRET_ACCESS_KEY" },
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "CREDENTIAL_INVALID" },
      });
      expect(result.ok === false && result.error.message).toContain("AWS_SECRET_ACCESS_KEY");
      expect(result.ok === false && result.error.message).toContain("not the key for provider");
    });

    it("accepts env credential refs with allowed provider env vars", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "gemini",
        apiKey: { kind: "env", varName: "GOOGLE_API_KEY" },
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({ ok: true });
    });

    it("rejects an allowed env var bound to a different provider than its own", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "gemini",
        apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "CREDENTIAL_INVALID" },
      });
      expect(result.ok === false && result.error.message).toContain("GOOGLE_API_KEY");
    });

    it("accepts ZAI_API_KEY as a valid credential env var", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "zai",
        apiKey: { kind: "env", varName: "ZAI_API_KEY" },
      });

      expect(result).toMatchObject({ ok: true });
    });

    it("accepts OPENROUTER_API_KEY as a valid credential env var", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "openrouter",
        apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
      });

      expect(result).toMatchObject({ ok: true });
    });

    it("rejects literal credential refs with whitespace-only values", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "gemini",
        apiKey: { kind: "literal", value: "   " },
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "CREDENTIAL_INVALID" },
      });
      expect(result.ok === false && result.error.message).toContain("empty or whitespace-only");
    });

    it("rejects whitespace-only legacy string API keys", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      const result = await saveConfig({
        provider: "gemini",
        apiKey: "   ",
        model: "gemini-2.5-flash",
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "CREDENTIAL_INVALID" },
      });
    });

    it("rejects arbitrary env var names that look like secrets", async () => {
      const store = await loadStore();
      await store.updateSettings({ secretsStorage: "file" });
      const { saveConfig } = await loadService();

      for (const varName of ["DATABASE_URL", "GITHUB_TOKEN", "HOME"]) {
        const result = await saveConfig({
          provider: "openrouter",
          apiKey: { kind: "env", varName },
        });

        expect(result).toMatchObject({
          ok: false,
          error: { code: "CREDENTIAL_INVALID" },
        });
      }
    });
  });
});

describe("getProviderModels (catalog)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the slim catalog payload for an enabled provider", async () => {
    catalog.getProviderModels.mockResolvedValue({
      models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M context", tier: "free", recommended: true }],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("gemini");
    expect(catalog.getProviderModels).toHaveBeenCalledWith("gemini");
    expect(result).toMatchObject({ ok: true, value: { models: [{ id: "gemini-2.5-flash", tier: "free", recommended: true }], source: "live", cached: false } });
  });

  it("rejects an unknown provider id with VALIDATION_ERROR without touching the catalog", async () => {
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("not-a-provider" as AIProvider);
    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("rejects a surfaced-but-disabled provider with the typed PROVIDER_DISABLED code", async () => {
    const { CatalogErrorSchema } = await import("@diffgazer/core/schemas/config");
    const { getProviderModels } = await loadService();

    const result = await getProviderModels("mistral");

    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { code: "PROVIDER_DISABLED" } });
    // The error is a real typed domain error, not an ad-hoc string.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(CatalogErrorSchema.safeParse(result.error).success).toBe(true);
  });

  it("refuses to serve OpenRouter from the catalog so it stays on its live key-gated route (D4)", async () => {
    const { CatalogErrorSchema } = await import("@diffgazer/core/schemas/config");
    const { getProviderModels } = await loadService();

    const result = await getProviderModels("openrouter");

    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { code: "PROVIDER_DISABLED" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(CatalogErrorSchema.safeParse(result.error).success).toBe(true);
  });

  it("rejects a catalog payload whose fetchedAt is not an RFC-3339 datetime at the boundary", async () => {
    catalog.getProviderModels.mockResolvedValue({
      models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" }],
      fetchedAt: "not-a-datetime",
      source: "live",
      cached: false,
    });
    const { getProviderModels } = await loadService();

    const result = await getProviderModels("gemini");

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });

  it("propagates catalog failures as INTERNAL_ERROR", async () => {
    catalog.getProviderModels.mockRejectedValue(new Error("catalog unavailable"));
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("groq");
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR", message: "catalog unavailable" } });
  });
});
