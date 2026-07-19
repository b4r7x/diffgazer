import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { InitResponse, ProviderStatus, SetupStatus } from "@diffgazer/core/schemas/config";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider, useConfigActions, useConfigData } from "@/hooks/use-config";

function makeSetupStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    hasSecretsStorage: true,
    hasProvider: true,
    hasModel: true,
    hasTrust: false,
    isConfigured: true,
    isReady: true,
    missing: [],
    ...overrides,
  };
}

function makeInitResponse(overrides: Partial<InitResponse> = {}): InitResponse {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    configured: true,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: makeSetupStatus(),
    ...overrides,
  };
}

function makeProviderStatus(): ProviderStatus[] {
  return [{ provider: "gemini", hasApiKey: true, isActive: true }];
}

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    loadInit: vi.fn().mockResolvedValue(makeInitResponse()),
    getProviderStatus: vi.fn().mockResolvedValue(makeProviderStatus()),
    activateProvider: vi.fn().mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    deleteProviderCredentials: vi.fn().mockResolvedValue({ deleted: true }),
  } satisfies BoundApi;
}

function ConfigConsumer() {
  const data = useConfigData();
  const actions = useConfigActions();

  return (
    <div>
      <p>Provider: {data.provider ?? "none"}</p>
      <p>Model: {data.model ?? "none"}</p>
      <p>Configured: {String(data.isConfigured)}</p>
      <p>Loading: {String(data.isLoading)}</p>
      <p>Config load: {data.loadState.status}</p>
      <p>Provider status load: {data.providerStatusLoadState.status}</p>
      <p>Project: {data.projectId ?? "none"}</p>
      <p>Provider rows: {data.providerStatus.length}</p>
      <button
        type="button"
        onClick={() =>
          void actions.activateProvider("gemini", "gemini-2.5-pro").catch(() => {
            // The activate action rejects; the consumer swallows it.
          })
        }
      >
        Activate Gemini
      </button>
      <button
        type="button"
        onClick={() => actions.saveCredentials("gemini", "sk-key", "gemini-2.5-flash")}
      >
        Save Gemini credentials
      </button>
      <button type="button" onClick={() => actions.deleteProviderCredentials("gemini")}>
        Delete Gemini credentials
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

  it("shows initial config after loading", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Provider: gemini")).toBeInTheDocument();
    expect(screen.getByText("Model: gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText("Project: proj-1")).toBeInTheDocument();
  });

  it("provides isConfigured=true when init reports configured", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Configured: true")).toBeInTheDocument();
  });

  it("provides isConfigured=false when no provider is configured", async () => {
    mockApi.loadInit.mockResolvedValue(
      makeInitResponse({
        config: null,
        setup: makeSetupStatus({ isConfigured: false, hasProvider: false, hasModel: false }),
      }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Configured: false")).toBeInTheDocument();
    expect(screen.getByText("Provider: none")).toBeInTheDocument();
  });

  it("settles loading and reports no provider when the init request fails", async () => {
    mockApi.loadInit.mockRejectedValue(new Error("Server down"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Provider: none")).toBeInTheDocument();
    expect(screen.getByText("Configured: false")).toBeInTheDocument();
    expect(screen.getByText("Config load: error")).toBeInTheDocument();
  });

  it("preserves valid init data and exposes a separate provider-status failure", async () => {
    mockApi.getProviderStatus.mockRejectedValue(new Error("Provider status unavailable"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Config load: ready")).toBeInTheDocument();
    expect(screen.getByText("Provider status load: error")).toBeInTheDocument();
    expect(screen.getByText("Provider: gemini")).toBeInTheDocument();
    expect(screen.getByText("Project: proj-1")).toBeInTheDocument();
    expect(screen.getByText("Provider rows: 1")).toBeInTheDocument();
  });

  it("exposes provider-status loading without hiding loaded init data", async () => {
    mockApi.getProviderStatus.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Config load: ready")).toBeInTheDocument();
    });

    expect(screen.getByText("Provider status load: loading")).toBeInTheDocument();
    expect(screen.getByText("Loading: true")).toBeInTheDocument();
    expect(screen.getByText("Provider: gemini")).toBeInTheDocument();
    expect(screen.getByText("Project: proj-1")).toBeInTheDocument();
  });

  it("reports loading=true while init requests are still pending", async () => {
    mockApi.loadInit.mockReturnValue(new Promise(() => {}));
    mockApi.getProviderStatus.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByText("Loading: true")).toBeInTheDocument();
  });

  it("shows the refreshed active model after activating a provider", async () => {
    const user = userEvent.setup();
    mockApi.loadInit.mockResolvedValueOnce(makeInitResponse()).mockResolvedValueOnce(
      makeInitResponse({
        config: { provider: "gemini", model: "gemini-2.5-pro" },
      }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /activate gemini/i }));

    await waitFor(() => {
      expect(screen.getByText("Model: gemini-2.5-pro")).toBeInTheDocument();
    });

    expect(mockApi.activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
  });

  it("shows the saved provider state after saving credentials", async () => {
    const user = userEvent.setup();
    mockApi.loadInit
      .mockResolvedValueOnce(
        makeInitResponse({
          config: null,
          setup: makeSetupStatus({ isConfigured: false, hasProvider: false, hasModel: false }),
        }),
      )
      .mockResolvedValueOnce(makeInitResponse());

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });
    expect(screen.getByText("Provider: none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save gemini credentials/i }));

    await waitFor(() => {
      expect(screen.getByText("Provider: gemini")).toBeInTheDocument();
    });

    expect(mockApi.saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: "sk-key",
      model: "gemini-2.5-flash",
    });
    expect(screen.getByText("Configured: true")).toBeInTheDocument();
  });

  it("shows the cleared provider state after deleting credentials", async () => {
    const user = userEvent.setup();
    mockApi.loadInit.mockResolvedValueOnce(makeInitResponse()).mockResolvedValueOnce(
      makeInitResponse({
        config: null,
        providers: [{ provider: "gemini", hasApiKey: false, isActive: false }],
        setup: makeSetupStatus({ isConfigured: false, hasProvider: false, hasModel: false }),
      }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /delete gemini credentials/i }));

    await waitFor(() => {
      expect(screen.getByText("Provider: none")).toBeInTheDocument();
    });

    expect(mockApi.deleteProviderCredentials).toHaveBeenCalledWith("gemini");
    expect(screen.getByText("Configured: false")).toBeInTheDocument();
  });

  it("keeps the current model when activating a provider fails", async () => {
    const user = userEvent.setup();
    mockApi.activateProvider.mockRejectedValue(new Error("Activation failed"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /activate gemini/i }));

    await waitFor(() => {
      expect(mockApi.activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    });
    expect(screen.getByText("Model: gemini-2.5-flash")).toBeInTheDocument();
  });

  it("keeps the actions context value referentially stable across a mutation isPending flip", async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    mockApi.saveConfig.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = () => resolve();
        }),
    );

    const actionsRefs: Array<ReturnType<typeof useConfigActions>> = [];

    function ActionsProbe() {
      const actions = useConfigActions();
      actionsRefs.push(actions);
      return (
        <button
          type="button"
          onClick={() => void actions.saveCredentials("gemini", "sk-key", "gemini-2.5-flash")}
        >
          Save
        </button>
      );
    }

    render(<ActionsProbe />, { wrapper: createConfigWrapper(mockApi) });

    const initialActions = actionsRefs[actionsRefs.length - 1];

    await user.click(screen.getByRole("button", { name: /save/i }));

    // The save mutation is now pending (isPending flipped true); the actions value must not change identity.
    expect(actionsRefs.at(-1)).toBe(initialActions);

    resolveSave?.();

    await waitFor(() => {
      expect(mockApi.saveConfig).toHaveBeenCalled();
    });

    // After the pending flag settles back, the actions value identity is still stable.
    expect(actionsRefs.at(-1)).toBe(initialActions);
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
