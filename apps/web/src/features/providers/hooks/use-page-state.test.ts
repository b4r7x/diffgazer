import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { getProviderRowId, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationInitResponse,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import {
  CLI_UNSUPPORTED_CONFIGURATION,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
  READINESS_PRESENTATION,
  READY_GEMINI_CONFIGURATION,
  REMOVED_ZAI_CODING_CONFIGURATION,
} from "@/testing/configuration-fixtures";
import { useProvidersPageState } from "./use-page-state";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => vi.fn(),
}));

function openRouterNotice() {
  const notice = PRODUCT_REGISTRY.openrouter.notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse([
      configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
      configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
      configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
      configurationStatus(REMOVED_ZAI_CODING_CONFIGURATION, "removed"),
    ]),
    ...overrides,
  };
}

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeInitResponse();
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...createConfigurationActionMocks(),
  } satisfies BoundApi;
}

let queryClient: QueryClient;
let mockApi: ReturnType<typeof createMockApi>;

describe("useProvidersPageState", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApi = createMockApi();
    clearScopedRouteState("/providers-page-test", "providerId");
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    clearScopedRouteState("/providers-page-test", "providerId");
  });

  it("dispatches the selected readiness action instead of key/model branches", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const localRow = result.current.filteredProviders.find(
      (row) => getProviderRowId(row) === "local-openai-1",
    );
    expect(localRow?.readiness.action).toBe("test");

    act(() => result.current.selection.setSelectedId("local-openai-1"));
    await act(async () => {
      if (localRow) await result.current.handlers.dispatchAction(localRow);
    });

    await waitFor(() => {
      expect(mockApi.testConfiguration).toHaveBeenCalledWith("local-openai-1");
    });
  });

  it("preserves selection by configuration ID across safe-summary refresh", async () => {
    const { result, rerender } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("gemini-primary"));
    expect(result.current.selection.effectiveSelectedId).toBe("gemini-primary");

    mockApi.loadConfigurationInit.mockResolvedValue(
      makeInitResponse({
        configurations: [
          {
            configuration: { ...READY_GEMINI_CONFIGURATION, revision: 2 },
            readiness: makeReadiness("ready", "gemini"),
          },
        ],
      }),
    );

    await act(async () => {
      await queryClient.invalidateQueries();
    });
    rerender();

    await waitFor(() => {
      expect(result.current.selectedRow?.configuration?.revision).toBe(2);
      expect(result.current.selection.effectiveSelectedId).toBe("gemini-primary");
    });
  });

  it("rejects removed-record activation", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const removed = result.current.filteredProviders.find(
      (row) => getProviderRowId(row) === "legacy-removed-zai-plan",
    );
    if (!removed) throw new Error("Expected removed row");

    act(() => result.current.selection.setSelectedId("legacy-removed-zai-plan"));
    act(() => result.current.handlers.dispatchAction(removed));

    expect(mockApi.selectConfiguration).not.toHaveBeenCalled();
    expect(result.current.dialogs.anyOpen).toBe(false);
  });

  it("keeps the model dialog on the created configuration after the row id changes", async () => {
    const createdOpenRouter: ClientConfigurationSummary = {
      configurationId: "openrouter-primary",
      revision: 1,
      status: "supported",
      transportFamily: "hosted-api",
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      selectedModelId: null,
      notices: [openRouterNotice()],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    };
    vi.mocked(mockApi.createConfiguration).mockResolvedValue({
      action: "create",
      status: "succeeded",
      configuration: createdOpenRouter,
    });

    const { result, rerender } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("openrouter"));
    act(() => result.current.actions.onSetup());
    const dialog = result.current.dialogs.current;
    if (dialog?.kind !== "setup") throw new Error("Expected the OpenRouter setup dialog");

    await act(async () => {
      await result.current.handlers.createConfiguration(
        dialog.owner,
        {
          transportFamily: "hosted-api",
          productId: "openrouter",
          endpoint: "https://openrouter.ai/api/v1",
        },
        { continueToModelSelection: true },
      );
    });

    // The refreshed list identifies the row by its new configuration id, so a
    // dialog resolved by the pre-create product id would vanish here.
    const refreshed = makeInitResponse({
      configurations: [configurationStatus(createdOpenRouter, "model-missing")],
    });
    mockApi.loadConfigurationInit.mockResolvedValue(refreshed);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(refreshed));
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    rerender();

    await waitFor(() => {
      expect(
        result.current.filteredProviders.some(
          (row) => getProviderRowId(row) === "openrouter-primary",
        ),
      ).toBe(true);
    });

    expect(result.current.dialogs.current?.kind).toBe("model");
    expect(result.current.dialogs.current?.row.configuration?.configurationId).toBe(
      "openrouter-primary",
    );
  });

  it("opens a setup dialog for update readiness without API-key branching", async () => {
    mockApi.loadConfigurationInit.mockResolvedValue(
      makeInitResponse({
        configurations: [
          {
            configuration: {
              ...LOCAL_OPENAI_CONFIGURATION,
              revision: 2,
            },
            readiness: {
              status: "credential-invalid",
              ready: false,
              evidenceStatus: "failed",
              checkedAt: "2026-07-31T12:00:00.000Z",
              acknowledgement: { status: "not-applicable" },
              ...READINESS_PRESENTATION["credential-invalid"],
            },
          },
        ],
      }),
    );

    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("local-openai-1"));
    const localRow = result.current.filteredProviders.find(
      (row) => getProviderRowId(row) === "local-openai-1",
    );
    if (!localRow) throw new Error("Expected local row");

    act(() => result.current.handlers.dispatchAction(localRow));

    expect(result.current.dialogs.current?.kind).toBe("setup");
    expect(result.current.dialogs.current?.row.product.transportFamily).toBe("local-http");
  });
});

function renderPageHook() {
  return renderHook(() => useProvidersPageState(), { wrapper: TestProviders });
}

function TestProviders({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      ApiProvider,
      { value: mockApi },
      createElement(KeyboardProvider, null, createElement(ConfigProvider, null, children)),
    ),
  );
}
