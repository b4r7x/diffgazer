import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { getProviderRowId, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationInitResponse,
} from "@diffgazer/core/schemas/config";
import { READINESS_PRESENTATION } from "@diffgazer/core/schemas/config";
import {
  CODEX_CLI_CONFIGURATION,
  configurationStatus,
  GEMINI_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  makeReadiness,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { useProvidersPageState } from "./use-page-state";

const routeSearch = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => vi.fn(),
  useSearch: () => routeSearch.current,
}));

function openRouterNotice() {
  const notice = PRODUCT_REGISTRY.openrouter.notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

const OPENROUTER_CONFIGURATION_ID = "cfg-00000000-0000-4000-8000-0000000000a1";

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse([
      configurationStatus(GEMINI_CONFIGURATION, "ready"),
      configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-conformance-failed"),
      configurationStatus(CODEX_CLI_CONFIGURATION, "unsupported"),
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
    routeSearch.current = {};
    clearScopedRouteState("/providers-page-test", "providerId");
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    clearScopedRouteState("/providers-page-test", "providerId");
  });

  it("selects a ready configuration through the primary action instead of inspecting it", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const readyRow = result.current.filteredProviders.find(
      (row) => getProviderRowId(row) === "gemini-primary",
    );
    expect(readyRow?.readiness.ready).toBe(true);

    act(() => result.current.selection.setSelectedId("gemini-primary"));
    const selectAction = result.current.providerActions[0];
    expect(selectAction).toMatchObject({ id: "selectConfiguration", task: "select-configuration" });

    await act(async () => {
      if (selectAction) result.current.runProviderAction(selectAction);
    });

    await waitFor(() => {
      expect(mockApi.selectConfiguration).toHaveBeenCalledWith(
        "gemini-primary",
        "gemini-2.5-flash",
      );
    });
    expect(mockApi.inspectConfiguration).not.toHaveBeenCalled();
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
            configuration: { ...GEMINI_CONFIGURATION, revision: 2 },
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

  it("keeps the model dialog on the created configuration after the row id changes", async () => {
    const createdOpenRouter: ClientConfigurationSummary = {
      configurationId: OPENROUTER_CONFIGURATION_ID,
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
    const createAction = result.current.providerActions.find((action) => action.id === "dispatch");
    if (!createAction) throw new Error("Expected the create action");
    act(() => result.current.runProviderAction(createAction));
    const dialog = result.current.dialogs.current;
    if (dialog?.kind !== "setup") throw new Error("Expected the OpenRouter setup dialog");

    const openrouterAck = {
      status: "accepted" as const,
      noticeId: PRODUCT_REGISTRY.openrouter.notice.id,
      noticeVersion: PRODUCT_REGISTRY.openrouter.notice.noticeVersion,
      acceptedAt: "2026-01-01T00:00:00.000Z",
    };

    await act(async () => {
      await result.current.handlers.createConfiguration(
        dialog.owner,
        {
          transportFamily: "hosted-api",
          productId: "openrouter",
          endpoint: "https://openrouter.ai/api/v1",
        },
        { continueToModelSelection: true, acknowledgement: openrouterAck },
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
          (row) => getProviderRowId(row) === OPENROUTER_CONFIGURATION_ID,
        ),
      ).toBe(true);
    });

    expect(result.current.dialogs.current?.kind).toBe("model");
    expect(result.current.dialogs.current?.row.configuration?.configurationId).toBe(
      OPENROUTER_CONFIGURATION_ID,
    );
    expect(result.current.selection.effectiveSelectedId).toBe(OPENROUTER_CONFIGURATION_ID);
    expect(result.current.selectedRow?.product.productId).toBe("openrouter");
  });

  it("keeps selection on the same product after configuration delete", async () => {
    const createdOpenRouter: ClientConfigurationSummary = {
      configurationId: OPENROUTER_CONFIGURATION_ID,
      revision: 1,
      status: "supported",
      transportFamily: "hosted-api",
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      selectedModelId: null,
      notices: [openRouterNotice()],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    };
    vi.mocked(mockApi.deleteConfiguration).mockResolvedValue({
      action: "delete",
      status: "succeeded",
    });

    const initWithOpenRouter = makeInitResponse({
      configurations: [configurationStatus(createdOpenRouter, "model-missing")],
    });
    mockApi.loadConfigurationInit.mockResolvedValue(initWithOpenRouter);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(initWithOpenRouter));

    const { result, rerender } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId(OPENROUTER_CONFIGURATION_ID));
    expect(result.current.selectedRow?.product.productId).toBe("openrouter");
    expect(result.current.selection.effectiveSelectedId).toBe(OPENROUTER_CONFIGURATION_ID);

    const deleteAction = result.current.providerActions.find((action) => action.id === "delete");
    if (!deleteAction) throw new Error("Expected the delete action");
    await act(async () => {
      result.current.runProviderAction(deleteAction);
    });

    const refreshed = makeInitResponse({ configurations: [] });
    mockApi.loadConfigurationInit.mockResolvedValue(refreshed);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(refreshed));
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    rerender();

    await waitFor(() => {
      expect(result.current.selection.effectiveSelectedId).toBe("openrouter");
      expect(result.current.selectedRow?.product.productId).toBe("openrouter");
    });
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

  it("derives no actions when the filtered list leaves nothing selected", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.search.setQuery("no-such-provider"));

    expect(result.current.selectedRow).toBeNull();
    expect(result.current.providerActions).toEqual([]);
  });

  it("derives a single action for an unconfigured provider", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("openrouter"));

    expect(result.current.providerActions.map((action) => action.label)).toEqual([
      "Create configuration",
    ]);
  });

  it("derives a de-duplicated action row for a ready provider", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("gemini-primary"));

    expect(result.current.providerActions.map((action) => action.label)).toEqual([
      "Select configuration",
      "Update configuration",
      "Select model",
      "Delete configuration",
    ]);
  });

  it("routes a derived action to its handler", async () => {
    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.selection.setSelectedId("openrouter"));
    const create = result.current.providerActions[0];
    if (!create) throw new Error("Expected a create action");
    act(() => result.current.runProviderAction(create));

    expect(result.current.dialogs.current?.kind).toBe("setup");
  });

  it("seeds the selection from the reconnect deep-link's product param", async () => {
    routeSearch.current = { product: "local-openai" };

    const { result } = renderPageHook();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedRow?.product.productId).toBe("local-openai");

    // The link seeds, the user decides: a later selection wins over the param.
    act(() => result.current.selection.setSelectedId("gemini"));
    expect(result.current.selectedRow?.product.productId).toBe("gemini");
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
