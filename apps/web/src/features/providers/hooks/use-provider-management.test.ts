import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { CredentialRef } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { useProviderManagement } from "./use-provider-management";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

// Boundary mock: external library (@diffgazer/ui) toast side-effect contract.
vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    error: toastMocks.error,
    success: toastMocks.success,
  },
}));

let queryClient: QueryClient;
let mockApi: ReturnType<typeof createMockApi>;

describe("useProviderManagement", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockApi = createMockApi();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("rejects a failed credential save without toasting so the dialog owns the report", async () => {
    mockApi.saveConfig.mockRejectedValue(new Error("Save failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openApiKeyDialog("gemini");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "api-key") throw new Error("Expected Gemini API-key dialog owner");

    await act(async () => {
      await expect(result.current.handleSaveApiKey(owner, "sk-test")).rejects.toThrow(
        "Save failed",
      );
    });

    expect(result.current.dialogOwner).toBe(owner);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("reports an activation failure with exactly one toast and no unhandled rejection", async () => {
    mockApi.activateProvider.mockRejectedValue(new Error("Activation failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      // Fire-and-forget handler must resolve (not reject) so void call sites
      // never produce an unhandled rejection.
      await expect(
        result.current.handleSelectProvider("gemini", "Gemini", "gemini-2.5-flash"),
      ).resolves.toBe(false);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Failed to Activate",
        expect.objectContaining({ message: "Activation failed" }),
      );
    });
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("reports a model-selection failure with one terminal toast and keeps the dialog open", async () => {
    mockApi.activateProvider.mockRejectedValue(new Error("Model save failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModelDialog("gemini");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "model") throw new Error("Expected Gemini model dialog owner");

    await act(async () => {
      await expect(result.current.handleSelectModel(owner, "gemini-2.5-pro")).resolves.toBe(false);
    });

    expect(result.current.dialogOwner).toBe(owner);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      "Failed to Select Model",
      expect.objectContaining({ message: "Model save failed" }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });

  it("reports a remove failure with one terminal toast and no unhandled rejection", async () => {
    mockApi.deleteProviderCredentials.mockRejectedValue(new Error("Remove failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.handleRemoveKey("gemini")).resolves.toBe(false);
    });

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Failed to Remove",
      expect.objectContaining({ message: "Remove failed" }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("returns true after a successful key removal with the expected API call and toast", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.handleRemoveKey("gemini")).resolves.toBe(true);
    });

    expect(mockApi.deleteProviderCredentials).toHaveBeenCalledWith("gemini");
    expect(mockApi.deleteProviderCredentials).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("API Key Removed", {
      message: "Provider key deleted",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("returns true after a successful provider activation with the expected API call and toast", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.handleSelectProvider("gemini", "Gemini", "gemini-2.5-flash"),
      ).resolves.toBe(true);
    });

    expect(mockApi.activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-flash");
    expect(mockApi.activateProvider).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("Provider Activated", {
      message: "Gemini is now active",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("returns true after model selection, closes the dialog, and toasts with the expected payload", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openModelDialog("gemini"));
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "model") throw new Error("Expected Gemini model dialog owner");

    await act(async () => {
      await expect(result.current.handleSelectModel(owner, "gemini-2.5-pro")).resolves.toBe(true);
    });

    expect(mockApi.activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    expect(mockApi.activateProvider).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("Model Selected", {
      message: "Selected gemini-2.5-pro",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(result.current.dialogOwner).toBeNull();
  });

  it("returns false and opens model selection when activation has no model", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.handleSelectProvider("gemini", "Gemini", undefined),
      ).resolves.toBe(false);
    });

    expect(mockApi.activateProvider).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledOnce();
    expect(result.current.dialogOwner).toMatchObject({ kind: "model", providerId: "gemini" });
  });

  it("carries the provider id from credential save into the model dialog", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openApiKeyDialog("openrouter");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "api-key") throw new Error("Expected OpenRouter API-key dialog owner");
    const apiKey: CredentialRef = { kind: "env", varName: "OPENROUTER_API_KEY" };
    await act(async () => {
      await result.current.handleSaveApiKey(owner, apiKey, { openModelDialog: true });
    });

    expect(mockApi.saveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey,
      model: undefined,
    });
    expect(mockApi.saveConfig).toHaveBeenCalledOnce();

    expect(result.current.dialogOwner).toMatchObject({
      kind: "model",
      providerId: "openrouter",
    });
  });

  it("blocks dialog openings while a credential save is pending", async () => {
    const openRouterSave = createDeferred<void>();
    mockApi.saveConfig.mockReturnValueOnce(openRouterSave.promise);

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openApiKeyDialog("openrouter");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "api-key") throw new Error("Expected OpenRouter API-key dialog owner");
    act(() => {
      void result.current.handleSaveApiKey(owner, "sk-openrouter", {
        openModelDialog: true,
      });
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    act(() => {
      result.current.closeDialog(owner);
      result.current.openApiKeyDialog("gemini");
    });

    expect(result.current.dialogOwner).toBeNull();

    openRouterSave.resolve(undefined);
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.dialogOwner).toBeNull();
  });

  it("keeps the API-key handoff owner when a peer dialog opening is declined", async () => {
    const save = createDeferred<void>();
    mockApi.saveConfig.mockReturnValueOnce(save.promise);

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openApiKeyDialog("openrouter");
    });
    const apiKeyOwner = result.current.dialogOwner;
    if (apiKeyOwner?.kind !== "api-key") {
      throw new Error("Expected OpenRouter API-key dialog owner");
    }
    act(() => {
      void result.current.handleSaveApiKey(apiKeyOwner, "sk-openrouter", {
        openModelDialog: true,
      });
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    act(() => {
      result.current.openModelDialog("gemini");
    });
    expect(result.current.dialogOwner).toBe(apiKeyOwner);

    save.resolve(undefined);
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.dialogOwner).toMatchObject({
      kind: "model",
      providerId: "openrouter",
    });
  });

  it("declines every other provider mutation while a save is pending", async () => {
    const save = createDeferred<void>();
    mockApi.saveConfig.mockReturnValueOnce(save.promise);

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openApiKeyDialog("openrouter"));
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "api-key") throw new Error("Expected OpenRouter API-key dialog owner");
    act(() => {
      void result.current.handleSaveApiKey(owner, "sk-openrouter");
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    let declinedResults: boolean[] = [];
    await act(async () => {
      result.current.openApiKeyDialog("gemini");
      result.current.openModelDialog("gemini");
      declinedResults = await Promise.all([
        result.current.handleRemoveKey("gemini"),
        result.current.handleSelectProvider("gemini", "Gemini", undefined),
        result.current.handleSelectModel(
          { kind: "model", id: 999, providerId: "gemini" },
          "gemini-2.5-pro",
        ),
      ]);
    });

    expect(declinedResults).toEqual([false, false, false]);
    expect(result.current.dialogOwner).toBe(owner);
    expect(mockApi.deleteProviderCredentials).not.toHaveBeenCalled();
    expect(mockApi.activateProvider).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();

    save.resolve(undefined);
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });

  it("keeps only the model dialog when peer opens are batched API-first", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openApiKeyDialog("openrouter");
      result.current.openModelDialog("gemini");
    });

    expect(result.current.dialogOwner).toMatchObject({ kind: "model", providerId: "gemini" });
  });

  it("keeps only the API-key dialog when peer opens are batched model-first", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModelDialog("gemini");
      result.current.openApiKeyDialog("openrouter");
    });

    expect(result.current.dialogOwner).toMatchObject({
      kind: "api-key",
      providerId: "openrouter",
    });
  });
});

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    activateProvider: vi.fn().mockResolvedValue({ provider: "gemini", model: "gemini-2.5-flash" }),
    deleteProviderCredentials: vi.fn().mockResolvedValue({ deleted: true }),
    getProviderStatus: vi
      .fn()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: true, isActive: true }]),
    loadInit: vi.fn().mockResolvedValue({
      config: { provider: "gemini", model: "gemini-2.5-flash" },
      configured: true,
      project: { projectId: "proj-1", path: "/repo", trust: null },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
      settings: {
        agentExecution: "parallel",
        defaultLenses: [],
        defaultProfile: null,
        secretsStorage: null,
        severityThreshold: "low",
        theme: "terminal",
      },
      setup: {
        hasModel: true,
        hasProvider: true,
        hasSecretsStorage: true,
        hasTrust: false,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  } satisfies BoundApi;
}

function renderManagedHook() {
  return renderHook(() => useProviderManagement(), { wrapper: TestProviders });
}

function TestProviders({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ApiProvider, { value: mockApi }, createElement(ConfigProvider, null, children)),
  );
}
