import { type BoundApi, createApi } from "@diffgazer/core/api";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ConfigurationInitResponse,
  ConfigurationListResponse,
} from "@diffgazer/core/schemas/config";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  OPENCODE_GO_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider, useConfigActions, useConfigData } from "@/hooks/use-config";
import {
  createConfigurationActionMocks,
  readyConfigurationStatus,
} from "@/testing/configuration-action-mocks";

const geminiEndpoint =
  GEMINI_CONFIGURATION.transportFamily === "hosted-api" ? GEMINI_CONFIGURATION.endpoint : "";

const acknowledgement = {
  status: "accepted" as const,
  noticeId: PRODUCT_REGISTRY.gemini.notice.id,
  noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
  acceptedAt: "2026-07-31T12:00:00.000Z",
};

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse([readyConfigurationStatus]),
    ...overrides,
  };
}

function makeConfigurationList(
  overrides: Partial<ConfigurationListResponse> = {},
): ConfigurationListResponse {
  return {
    ...makeConfigurationListResponse(makeInitResponse()),
    ...overrides,
  };
}

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(makeInitResponse()),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationList()),
    ...createConfigurationActionMocks(),
  } satisfies BoundApi;
}

function ConfigConsumer() {
  const data = useConfigData();
  const actions = useConfigActions();

  return (
    <div>
      <p>Loading: {String(data.isLoading)}</p>
      <p>Config load: {data.loadState.status}</p>
      <p>Configured: {String(data.isConfigured)}</p>
      <p>Ready: {String(data.isReady)}</p>
      <p>Rows: {data.configurations.length}</p>
      <p>Selected: {data.selectedConfiguration?.configurationId ?? "none"}</p>
      {/* The home Provider row reads this string verbatim. */}
      <p>Provider: {data.provider ?? "none"}</p>
      <p>Project: {data.projectId ?? "none"}</p>
      <pre data-testid="context-json">{JSON.stringify(data)}</pre>
      <button type="button" onClick={() => void actions.inspectConfiguration("gemini-primary")}>
        Inspect configuration
      </button>
      <button
        type="button"
        onClick={() =>
          void actions.selectConfiguration("gemini-primary", "gemini-2.5-flash", geminiEndpoint)
        }
      >
        Select configuration
      </button>
      <button type="button" onClick={() => void actions.testConfiguration("gemini-primary")}>
        Test configuration
      </button>
      <button
        type="button"
        onClick={() =>
          void actions.updateConfiguration({
            configurationId: "gemini-primary",
            expectedRevision: 1,
            input: {
              transportFamily: "hosted-api",
              productId: "gemini",
              endpoint: geminiEndpoint,
            },
            acknowledgement,
          })
        }
      >
        Update configuration
      </button>
      <button
        type="button"
        onClick={() =>
          void actions.deleteConfiguration({
            configurationId: "gemini-primary",
            expectedRevision: 1,
          })
        }
      >
        Delete configuration
      </button>
      <button
        type="button"
        onClick={() =>
          void actions.createConfiguration({
            input: {
              transportFamily: "hosted-api",
              productId: "gemini",
              endpoint: geminiEndpoint,
            },
          })
        }
      >
        Create configuration
      </button>
    </div>
  );
}

let queryClient: ReturnType<typeof createTestQueryWrapper>["queryClient"] | undefined;
let mockApi: ReturnType<typeof createMockApi>;

function createConfigWrapper(api = mockApi) {
  const { Wrapper: ApiWrapper, queryClient: nextQueryClient } = createTestQueryWrapper({ api });
  queryClient = nextQueryClient;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <ConfigProvider>{children}</ConfigProvider>
      </ApiWrapper>
    );
  };
}

function renderWithProvider(api = mockApi) {
  return render(<ConfigConsumer />, { wrapper: createConfigWrapper(api) });
}

describe("ConfigProvider", () => {
  beforeEach(() => {
    mockApi = createMockApi();
  });

  afterEach(() => {
    cleanup();
    queryClient?.clear();
    queryClient = undefined;
  });

  it("exposes safe configuration summaries without legacy provider-status facades", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Config load: ready")).toBeInTheDocument();
    expect(screen.getByText("Selected: gemini-primary")).toBeInTheDocument();
    expect(screen.getByText("Ready: true")).toBeInTheDocument();
    expect(screen.getByText("Rows: 1")).toBeInTheDocument();

    const serialized = screen.getByTestId("context-json").textContent ?? "";
    expect(serialized).not.toContain("providerStatus");
    expect(serialized).not.toContain("saveCredentials");
    expect(serialized).not.toContain("activateProvider");
    expect(serialized).not.toContain("deleteProviderCredentials");
    expect(serialized).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(serialized).not.toContain('"apiKey"');
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toMatch(/"secret"\s*:/);
  });

  it("names the bound billing pool in the home Provider row", async () => {
    mockApi.loadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([configurationStatus(OPENCODE_GO_CONFIGURATION, "ready")]),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Provider: OpenCode · Go")).toBeInTheDocument();
    });
  });

  it("keeps both context values referentially stable across a configuration mutation", async () => {
    const dataValues: unknown[] = [];
    const actionValues: unknown[] = [];

    function IdentityProbe() {
      dataValues.push(useConfigData());
      actionValues.push(useConfigActions());
      return null;
    }

    const user = userEvent.setup();
    render(
      <>
        <ConfigConsumer />
        <IdentityProbe />
      </>,
      { wrapper: createConfigWrapper() },
    );
    await waitFor(() => expect(screen.getByText("Loading: false")).toBeInTheDocument());

    const dataBefore = dataValues.at(-1);
    const actionsBefore = actionValues.at(-1);
    const rendersBefore = dataValues.length;

    await user.click(screen.getByRole("button", { name: "Inspect configuration" }));
    await waitFor(() => expect(mockApi.inspectConfiguration).toHaveBeenCalledOnce());
    await waitFor(() => expect(mockApi.loadConfigurationInit.mock.calls.length).toBeGreaterThan(1));

    // The mutation transition re-renders the provider; unchanged context values
    // mean app-wide consumers are never woken by it.
    expect(dataValues.length).toBe(rendersBefore);
    expect(dataValues.at(-1)).toBe(dataBefore);
    expect(actionValues.at(-1)).toBe(actionsBefore);
  });

  it("reports unconfigured when no configuration is selected", async () => {
    mockApi.loadConfigurationInit.mockResolvedValue(
      makeInitResponse({ selectedConfigurationId: null, configurations: [] }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Configured: false")).toBeInTheDocument();
    });
    expect(screen.getByText("Ready: false")).toBeInTheDocument();
    expect(screen.getByText("Selected: none")).toBeInTheDocument();
  });

  it("settles to error when initialization fails", async () => {
    mockApi.loadConfigurationInit.mockRejectedValue(new Error("Server down"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Config load: error")).toBeInTheDocument();
    });
    expect(screen.getByText("Configured: false")).toBeInTheDocument();
  });

  it.each([
    ["Inspect configuration", "inspectConfiguration"],
    ["Select configuration", "selectConfiguration"],
    ["Test configuration", "testConfiguration"],
    ["Update configuration", "updateConfiguration"],
    ["Delete configuration", "deleteConfiguration"],
    ["Create configuration", "createConfiguration"],
  ] as const)("dispatches the $1 action through V2 hooks", async (label, method) => {
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() => {
      expect(mockApi[method as keyof typeof mockApi]).toHaveBeenCalled();
    });
  });

  it("carries the billing pool from the select action through to the API call", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Select configuration" }));

    await waitFor(() => {
      expect(mockApi.selectConfiguration).toHaveBeenCalledWith(
        "gemini-primary",
        "gemini-2.5-flash",
        geminiEndpoint,
      );
    });
  });

  it("throws when useConfigData is called outside the provider", () => {
    function Orphan() {
      useConfigData();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow("useConfigData must be used within a ConfigProvider");
  });

  it("throws when useConfigActions is called outside the provider", () => {
    function Orphan() {
      useConfigActions();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      "useConfigActions must be used within a ConfigProvider",
    );
  });
});
