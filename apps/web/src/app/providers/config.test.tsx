import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider, useConfigActions, useConfigData } from "./config";

function makeSetupStatus(overrides: Record<string, unknown> = {}) {
  return {
    hasSecretsStorage: true,
    hasProvider: true,
    hasModel: true,
    hasTrust: false,
    isConfigured: true,
    isReady: true,
    missing: [] as string[],
    ...overrides,
  };
}

function makeInitResponse(overrides: Record<string, unknown> = {}) {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [
      { provider: "gemini", hasApiKey: true, isActive: true },
    ],
    settings: { theme: "terminal", defaultLenses: [], defaultProfile: null, severityThreshold: "low", secretsStorage: null, agentExecution: "parallel" },
    configured: true,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: makeSetupStatus(),
    ...overrides,
  };
}

function makeProviderStatus() {
  return [
    { provider: "gemini", hasApiKey: true, isActive: true },
  ];
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
      <p>Saving: {String(actions.isSaving)}</p>
      <p>Error: {actions.error ?? "none"}</p>
      <p>Project: {data.projectId ?? "none"}</p>
      <button type="button" onClick={() => actions.activateProvider("gemini", "gemini-2.5-pro")}>
        Activate Gemini
      </button>
      <button type="button" onClick={() => actions.saveCredentials("gemini", "sk-key", "gemini-2.5-flash")}>
        Save Gemini credentials
      </button>
      <button type="button" onClick={() => actions.deleteProviderCredentials("gemini")}>
        Delete Gemini credentials
      </button>
    </div>
  );
}

let queryClient: QueryClient;
let mockApi: ReturnType<typeof createMockApi>;

function renderWithProvider(api = mockApi) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
}

describe("ConfigProvider", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockApi = createMockApi();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
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

  it("surfaces an error message when the init request fails", async () => {
    mockApi.loadInit.mockRejectedValue(new Error("Server down"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    expect(screen.getByText("Error: Server down")).toBeInTheDocument();
  });

  it("reports loading=true while init requests are still pending", async () => {
    mockApi.loadInit.mockReturnValue(new Promise(() => {}));
    mockApi.getProviderStatus.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByText("Loading: true")).toBeInTheDocument();
  });

  it("shows the refreshed active model after activating a provider", async () => {
    const user = userEvent.setup();
    mockApi.loadInit
      .mockResolvedValueOnce(makeInitResponse())
      .mockResolvedValueOnce(
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
    mockApi.loadInit
      .mockResolvedValueOnce(makeInitResponse())
      .mockResolvedValueOnce(
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

  it("surfaces an error message when activating a provider fails", async () => {
    const user = userEvent.setup();
    mockApi.activateProvider.mockRejectedValue(new Error("Activation failed"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Loading: false")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /activate gemini/i }));

    await waitFor(() => {
      expect(screen.getByText("Error: Activation failed")).toBeInTheDocument();
    });
  });

  it("throws when useConfigData is called outside the provider", () => {
    function Orphan() {
      useConfigData();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      "useConfigData must be used within a ConfigProvider",
    );
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
