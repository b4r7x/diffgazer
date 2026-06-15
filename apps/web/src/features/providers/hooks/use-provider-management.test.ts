import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
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

  it("rethrows a failed credential save WITHOUT toasting so the dialog owns the report", async () => {
    mockApi.saveConfig.mockRejectedValue(new Error("Save failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setApiKeyDialogOpen(true);
    });

    await act(async () => {
      await expect(result.current.handleSaveApiKey("gemini", "sk-test")).rejects.toThrow(
        "Save failed",
      );
    });

    // Dialog stays open and the inline error (F-465) is the single report — no toast.
    expect(result.current.apiKeyDialogOpen).toBe(true);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("reports an activation failure with exactly one toast and no unhandled rejection", async () => {
    mockApi.activateProvider.mockRejectedValue(new Error("Activation failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      // Fire-and-forget handler must resolve (not reject) so void call sites
      // never produce an unhandled rejection (F-024).
      await expect(
        result.current.handleSelectProvider("gemini", "Gemini", "gemini-2.5-flash"),
      ).resolves.toBeUndefined();
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
      result.current.setModelDialogOpen(true);
    });

    await act(async () => {
      await expect(
        result.current.handleSelectModel("gemini", "gemini-2.5-pro"),
      ).resolves.toBeUndefined();
    });

    expect(result.current.modelDialogOpen).toBe(true);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });

  it("reports a remove failure with one terminal toast and no unhandled rejection", async () => {
    mockApi.deleteProviderCredentials.mockRejectedValue(new Error("Remove failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.handleRemoveKey("gemini")).resolves.toBeUndefined();
    });

    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
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
