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

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../../shared/lib/config/keyring.js", () => keyring);
// Boundary mock: openrouter-models wraps the OpenRouter HTTP API (network boundary); tests provide canned model list responses so service behavior can be exercised offline.
vi.mock("../../shared/lib/ai/openrouter-models.js", () => openRouter);

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
  return import("../../shared/lib/config/store.js");
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
    it("rejects env credential refs with disallowed env var names", async () => {
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
      expect(result.ok === false && result.error.message).toContain("not an allowed provider key");
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
