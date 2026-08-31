import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { getProviderRowId, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { ProviderManagementOutcome } from "@diffgazer/core/providers/hooks";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  READINESS_PRESENTATION,
} from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
  OPENCODE_GO_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { useProviderManagement } from "./use-provider-management";

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    error: toastMocks.error,
    success: toastMocks.success,
  },
}));

const openrouterNotice = {
  ...PRODUCT_REGISTRY.openrouter.notice,
  billing: [...PRODUCT_REGISTRY.openrouter.notice.billing],
  privacy: [...PRODUCT_REGISTRY.openrouter.notice.privacy],
};

const acknowledgement = {
  status: "accepted" as const,
  noticeId: PRODUCT_REGISTRY.gemini.notice.id,
  noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
  acceptedAt: "2026-07-31T12:00:00.000Z",
};

const supportedConfiguration = GEMINI_CONFIGURATION;
const geminiEndpoint =
  supportedConfiguration.transportFamily === "hosted-api" ? supportedConfiguration.endpoint : "";

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse([configurationStatus(supportedConfiguration, "ready")]),
    ...overrides,
  };
}

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

  it("resolves a failed configuration update as a failure outcome without toasting so the dialog owns the report", async () => {
    vi.mocked(mockApi.updateConfiguration).mockRejectedValue(new Error("Save failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openSetupDialog("gemini-primary");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected Gemini setup dialog owner");

    await act(async () => {
      await expect(
        result.current.handleUpdateConfiguration(owner, {
          configurationId: "gemini-primary",
          expectedRevision: 1,
          input: {
            transportFamily: "hosted-api",
            productId: "gemini",
            endpoint: geminiEndpoint,
          },
          acknowledgement,
        }),
      ).resolves.toEqual({ status: "failed", message: "Save failed" });
    });

    expect(result.current.dialogOwner).toBe(owner);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("reports a selection failure with exactly one toast and no unhandled rejection", async () => {
    vi.mocked(mockApi.selectConfiguration).mockRejectedValue(new Error("Selection failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    await act(async () => {
      await expect(
        result.current.handleSelectConfiguration(row, "gemini-2.5-flash"),
      ).resolves.toEqual({ status: "failed", message: "Selection failed" });
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Failed to Select",
        expect.objectContaining({ message: "Selection failed" }),
      );
    });
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("reports a model-selection failure with one terminal toast and keeps the dialog open", async () => {
    vi.mocked(mockApi.selectConfiguration).mockRejectedValue(new Error("Model save failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModelDialog("gemini-primary");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "model") throw new Error("Expected Gemini model dialog owner");

    await act(async () => {
      await expect(result.current.handleSelectModel(owner, "gemini-2.5-pro")).resolves.toEqual({
        status: "failed",
        message: "Model save failed",
      });
    });

    expect(result.current.dialogOwner).toBe(owner);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      "Failed to Select Model",
      expect.objectContaining({ message: "Model save failed" }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });

  it("reports a delete failure with one terminal toast and no unhandled rejection", async () => {
    vi.mocked(mockApi.deleteConfiguration).mockRejectedValue(new Error("Remove failed"));

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.handleDeleteConfiguration("gemini-primary", 1)).resolves.toEqual({
        status: "failed",
        message: "Remove failed",
      });
    });

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Failed to Delete",
      expect.objectContaining({ message: "Remove failed" }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("reports a resolved-but-failed readiness test with the server explanation, not a success toast", async () => {
    const explanation = READINESS_PRESENTATION["conformance-failed"].explanation;
    vi.mocked(mockApi.loadConfigurationInit).mockResolvedValue(
      makeInitResponse({
        configurations: [configurationStatus(supportedConfiguration, "conformance-pending")],
      }),
    );
    vi.mocked(mockApi.testConfiguration).mockResolvedValue(
      ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: "failed",
        configuration: supportedConfiguration,
        readiness: makeReadiness("conformance-failed"),
      }) as Awaited<ReturnType<BoundApi["testConfiguration"]>>,
    );

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    await act(async () => {
      await expect(result.current.handleDispatchReadinessAction(row)).resolves.toEqual({
        status: "failed",
        message: explanation,
      });
    });

    expect(toastMocks.error).toHaveBeenCalledWith(
      "Verification Failed",
      expect.objectContaining({ message: explanation }),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("toasts Verified only for a test response that reports succeeded", async () => {
    vi.mocked(mockApi.loadConfigurationInit).mockResolvedValue(
      makeInitResponse({
        configurations: [configurationStatus(supportedConfiguration, "conformance-pending")],
      }),
    );

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    await act(async () => {
      await expect(result.current.handleDispatchReadinessAction(row)).resolves.toEqual({
        status: "succeeded",
      });
    });

    expect(mockApi.testConfiguration).toHaveBeenCalledWith("gemini-primary");
    expect(toastMocks.success).toHaveBeenCalledWith("Verified", {
      message: "The configuration produced structured review output",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("succeeds a delete with the expected API call and toast", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.handleDeleteConfiguration("gemini-primary", 1)).resolves.toEqual({
        status: "succeeded",
      });
    });

    expect(mockApi.deleteConfiguration).toHaveBeenCalledWith("gemini-primary", 1);
    expect(mockApi.deleteConfiguration).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("Configuration Deleted", {
      message: "Provider configuration deleted",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("succeeds a configuration selection with the expected API call and toast", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    await act(async () => {
      await expect(
        result.current.handleSelectConfiguration(row, "gemini-2.5-flash"),
      ).resolves.toEqual({ status: "succeeded" });
    });

    expect(mockApi.selectConfiguration).toHaveBeenCalledWith(
      "gemini-primary",
      "gemini-2.5-flash",
      undefined,
    );
    expect(mockApi.selectConfiguration).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("Configuration Selected", {
      message: "Google Gemini is now active",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("names the billing pool in the selection toast, as the row and the header do", async () => {
    vi.mocked(mockApi.loadConfigurationInit).mockResolvedValue(
      makeInitResponse({
        configurations: [configurationStatus(OPENCODE_GO_CONFIGURATION, "ready")],
      }),
    );
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) =>
        provider.configuration?.configurationId === OPENCODE_GO_CONFIGURATION.configurationId,
    );
    if (!row) throw new Error("Expected the OpenCode Go row");

    await act(async () => {
      await result.current.handleSelectConfiguration(
        row,
        OPENCODE_GO_CONFIGURATION.selectedModelId,
      );
    });

    // "OpenCode Zen is now active" beside a header that just read "OpenCode Go"
    // named two things for one record.
    expect(toastMocks.success).toHaveBeenCalledWith("Configuration Selected", {
      message: "OpenCode Go is now active",
    });
  });

  it("succeeds model selection, closes the dialog, and toasts with the expected payload", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openModelDialog("gemini-primary"));
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "model") throw new Error("Expected Gemini model dialog owner");

    await act(async () => {
      await expect(result.current.handleSelectModel(owner, "gemini-2.5-pro")).resolves.toEqual({
        status: "succeeded",
      });
    });

    expect(mockApi.selectConfiguration).toHaveBeenCalledWith(
      "gemini-primary",
      "gemini-2.5-pro",
      undefined,
    );
    expect(mockApi.selectConfiguration).toHaveBeenCalledOnce();
    expect(toastMocks.success).toHaveBeenCalledWith("Model Selected", {
      message: "Selected gemini-2.5-pro",
    });
    expect(toastMocks.success).toHaveBeenCalledOnce();
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(result.current.dialogOwner).toBeNull();
  });

  it("requires input and opens model selection when selection has no model", async () => {
    vi.mocked(mockApi.loadConfigurationInit).mockResolvedValue(
      makeInitResponse({
        configurations: [
          {
            configuration: { ...supportedConfiguration, selectedModelId: null },
            readiness: {
              status: "model-missing",
              ready: false,
              evidenceStatus: "failed",
              checkedAt: "2026-07-31T12:00:00.000Z",
              acknowledgement: { status: "not-applicable" },
              ...READINESS_PRESENTATION["model-missing"],
            },
          },
        ],
      }),
    );

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    await act(async () => {
      await expect(result.current.handleSelectConfiguration(row)).resolves.toEqual({
        status: "input-required",
      });
    });

    expect(mockApi.selectConfiguration).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(result.current.dialogOwner).toMatchObject({
      kind: "model",
      rowId: "gemini-primary",
    });
  });

  it("carries the row id from configuration create into the model dialog", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openSetupDialog("openrouter");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected OpenRouter setup dialog owner");
    const openrouterAck = {
      status: "accepted" as const,
      noticeId: PRODUCT_REGISTRY.openrouter.notice.id,
      noticeVersion: PRODUCT_REGISTRY.openrouter.notice.noticeVersion,
      acceptedAt: "2026-01-01T00:00:00.000Z",
    };

    await act(async () => {
      await result.current.handleCreateConfiguration(
        owner,
        {
          transportFamily: "hosted-api",
          productId: "openrouter",
          endpoint: "https://openrouter.ai/api/v1",
        },
        { continueToModelSelection: true, acknowledgement: openrouterAck },
      );
    });

    expect(mockApi.createConfiguration).toHaveBeenCalledWith({
      input: {
        transportFamily: "hosted-api",
        productId: "openrouter",
        endpoint: "https://openrouter.ai/api/v1",
      },
      acknowledgement: openrouterAck,
    });
    expect(mockApi.createConfiguration).toHaveBeenCalledOnce();

    expect(result.current.dialogOwner).toMatchObject({
      kind: "model",
      rowId: "openrouter",
      configurationId: "openrouter-primary",
    });
  });

  it("blocks dialog openings while a configuration update is pending", async () => {
    const update = createDeferred<Awaited<ReturnType<BoundApi["updateConfiguration"]>>>();
    vi.mocked(mockApi.updateConfiguration).mockReturnValueOnce(
      update.promise as ReturnType<BoundApi["updateConfiguration"]>,
    );

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openSetupDialog("openrouter");
    });
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected OpenRouter setup dialog owner");
    act(() => {
      void result.current.handleUpdateConfiguration(
        owner,
        {
          configurationId: "gemini-primary",
          expectedRevision: 1,
          input: {
            transportFamily: "hosted-api",
            productId: "openrouter",
            endpoint: "https://openrouter.ai/api/v1",
          },
          acknowledgement,
        },
        { continueToModelSelection: true },
      );
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    act(() => {
      result.current.closeDialog(owner);
      result.current.openSetupDialog("gemini");
    });

    expect(result.current.dialogOwner).toBeNull();

    update.resolve(
      ClientConfigurationActionResponseSchema.parse({
        action: "update",
        status: "succeeded",
        configuration: supportedConfiguration,
      }) as Awaited<ReturnType<BoundApi["updateConfiguration"]>>,
    );
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.dialogOwner).toBeNull();
  });

  it("declines every other provider mutation while an update is pending", async () => {
    const update = createDeferred<Awaited<ReturnType<BoundApi["updateConfiguration"]>>>();
    vi.mocked(mockApi.updateConfiguration).mockReturnValueOnce(
      update.promise as ReturnType<BoundApi["updateConfiguration"]>,
    );

    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openSetupDialog("openrouter"));
    const owner = result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected OpenRouter setup dialog owner");
    act(() => {
      void result.current.handleUpdateConfiguration(owner, {
        configurationId: "gemini-primary",
        expectedRevision: 1,
        input: {
          transportFamily: "hosted-api",
          productId: "openrouter",
          endpoint: "https://openrouter.ai/api/v1",
        },
        acknowledgement,
      });
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    const row = result.current.providers.find(
      (provider) => getProviderRowId(provider) === "gemini-primary",
    );
    if (!row) throw new Error("Expected Gemini row");

    let declinedResults: ProviderManagementOutcome[] = [];
    await act(async () => {
      result.current.openSetupDialog("gemini");
      result.current.openModelDialog("gemini-primary");
      declinedResults = await Promise.all([
        result.current.handleDeleteConfiguration("gemini-primary", 1),
        result.current.handleSelectConfiguration(row),
        result.current.handleSelectModel(
          { kind: "model", id: 999, rowId: "gemini-primary", configurationId: "gemini-primary" },
          "gemini-2.5-pro",
        ),
      ]);
    });

    expect(declinedResults).toEqual([
      { status: "input-required" },
      { status: "input-required" },
      { status: "input-required" },
    ]);
    expect(result.current.dialogOwner).toBe(owner);
    expect(mockApi.deleteConfiguration).not.toHaveBeenCalled();
    expect(mockApi.selectConfiguration).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();

    update.resolve(
      ClientConfigurationActionResponseSchema.parse({
        action: "update",
        status: "succeeded",
        configuration: supportedConfiguration,
      }) as Awaited<ReturnType<BoundApi["updateConfiguration"]>>,
    );
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });

  it("keeps only the model dialog when peer opens are batched setup-first", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openSetupDialog("openrouter");
      result.current.openModelDialog("gemini-primary");
    });

    expect(result.current.dialogOwner).toMatchObject({
      kind: "model",
      rowId: "gemini-primary",
    });
  });

  it("keeps only the setup dialog when peer opens are batched model-first", async () => {
    const { result } = renderManagedHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openModelDialog("gemini-primary");
      result.current.openSetupDialog("openrouter");
    });

    expect(result.current.dialogOwner).toMatchObject({
      kind: "setup",
      rowId: "openrouter",
    });
  });
});

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeInitResponse();
  const actionMocks = createConfigurationActionMocks();
  vi.mocked(actionMocks.createConfiguration).mockResolvedValue(
    ClientConfigurationActionResponseSchema.parse({
      action: "create",
      status: "succeeded",
      configuration: {
        ...supportedConfiguration,
        configurationId: "openrouter-primary",
        productId: "openrouter",
        endpoint: "https://openrouter.ai/api/v1",
        selectedModelId: null,
        notices: [openrouterNotice],
      },
    }) as Awaited<ReturnType<BoundApi["createConfiguration"]>>,
  );
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...actionMocks,
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
