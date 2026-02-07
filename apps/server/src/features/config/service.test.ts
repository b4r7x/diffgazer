import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../shared/lib/config/store.js", () => ({
  getProviders: vi.fn(),
  getActiveProvider: vi.fn(),
  getProviderApiKey: vi.fn(),
  saveProviderCredentials: vi.fn(),
  deleteProviderCredentials: vi.fn(),
  activateProvider: vi.fn(),
  getSettings: vi.fn().mockReturnValue({
    secretsStorage: "keyring",
    defaultLenses: ["correctness"],
    agentExecution: "parallel",
  }),
  getProjectInfo: vi.fn().mockReturnValue({
    trust: { capabilities: { readFiles: true } },
  }),
}));

vi.mock("../../shared/lib/ai/openrouter-models.js", () => ({
  getOpenRouterModelsWithCache: vi.fn(),
}));

import {
  getProvidersStatus,
  checkConfig,
  activateProvider,
  getConfig,
  saveConfig,
  deleteProvider,
  getOpenRouterModels,
  getSetupStatus,
  getInitState,
} from "./service.js";
import {
  getProviders,
  getActiveProvider,
  getProviderApiKey,
  saveProviderCredentials,
  deleteProviderCredentials,
  activateProvider as activateProviderInStore,
} from "../../shared/lib/config/store.js";
import { getOpenRouterModelsWithCache } from "../../shared/lib/ai/openrouter-models.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProvidersStatus", () => {
  it("should return providers and active provider", () => {
    vi.mocked(getProviders).mockReturnValue([
      { provider: "gemini", model: "gemini-2.5-flash", isActive: true },
      { provider: "openrouter", model: null, isActive: false },
    ] as any);

    const result = getProvidersStatus();

    expect(result.providers).toHaveLength(2);
    expect(result.activeProvider).toBe("gemini");
  });

  it("should return undefined activeProvider when none active", () => {
    vi.mocked(getProviders).mockReturnValue([
      { provider: "gemini", model: "m1", isActive: false },
    ] as any);

    expect(getProvidersStatus().activeProvider).toBeUndefined();
  });
});

describe("checkConfig", () => {
  it("should return configured: true when config exists", () => {
    vi.mocked(getActiveProvider).mockReturnValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
    } as any);
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: true,
      value: "sk-123",
    });

    const result = checkConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.configured).toBe(true);
    }
  });

  it("should return configured: false when no active provider", () => {
    vi.mocked(getActiveProvider).mockReturnValue(null);

    const result = checkConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.configured).toBe(false);
    }
  });

  it("should return configured: false when no API key", () => {
    vi.mocked(getActiveProvider).mockReturnValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
    } as any);
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: true,
      value: null,
    });

    const result = checkConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.configured).toBe(false);
    }
  });

  it("should propagate error from getProviderApiKey", () => {
    vi.mocked(getActiveProvider).mockReturnValue({
      provider: "gemini",
      model: "m1",
    } as any);
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: false,
      error: { code: "KEYRING_READ_FAILED", message: "fail" },
    });

    const result = checkConfig();

    expect(result.ok).toBe(false);
  });
});

describe("activateProvider", () => {
  it("should activate provider with model", () => {
    vi.mocked(activateProviderInStore).mockReturnValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
    } as any);

    const result = activateProvider({
      provider: "gemini" as any,
      model: "gemini-2.5-flash",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
    }
  });

  it("should require model when provider has no existing model", () => {
    vi.mocked(getProviders).mockReturnValue([
      { provider: "gemini", model: null, isActive: false },
    ] as any);

    const result = activateProvider({ provider: "gemini" as any });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_BODY");
    }
  });

  it("should return error when provider not found", () => {
    vi.mocked(activateProviderInStore).mockReturnValue(null);

    const result = activateProvider({
      provider: "gemini" as any,
      model: "m1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_NOT_FOUND");
    }
  });
});

describe("getOpenRouterModels", () => {
  it("should return models when API key exists", async () => {
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: true,
      value: "sk-123",
    });
    vi.mocked(getOpenRouterModelsWithCache).mockResolvedValue({
      models: [{ id: "model-1", name: "M1" }] as any,
      fetchedAt: "2024-01-01",
      cached: false,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.models).toHaveLength(1);
    }
  });

  it("should return error when no API key", async () => {
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: true,
      value: null,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_MISSING");
    }
  });

  it("should handle fetch errors", async () => {
    vi.mocked(getProviderApiKey).mockReturnValue({
      ok: true,
      value: "sk-123",
    });
    vi.mocked(getOpenRouterModelsWithCache).mockRejectedValue(
      new Error("network error"),
    );

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("getSetupStatus", () => {
  it("should report missing fields", () => {
    vi.mocked(getProviders).mockReturnValue([]);

    const status = getSetupStatus("/project");

    expect(status.hasProvider).toBe(false);
    expect(status.missing).toContain("provider");
  });
});

describe("saveConfig", () => {
  it("should delegate to saveProviderCredentials", () => {
    vi.mocked(saveProviderCredentials).mockReturnValue({
      ok: true,
      value: { provider: "gemini", model: "m1", isActive: true },
    } as any);

    const result = saveConfig({
      provider: "gemini" as any,
      apiKey: "key",
      model: "m1",
    });

    expect(result.ok).toBe(true);
    expect(saveProviderCredentials).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: "key",
      model: "m1",
    });
  });
});

describe("deleteProvider", () => {
  it("should delete provider credentials", () => {
    vi.mocked(deleteProviderCredentials).mockReturnValue({
      ok: true,
      value: true,
    });

    const result = deleteProvider("gemini" as any);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
    }
  });
});
