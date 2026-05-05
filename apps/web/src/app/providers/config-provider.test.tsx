import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { useConfigData, useConfigActions, ConfigProvider } from "./config-provider";

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

function createMockApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    loadInit: vi.fn().mockResolvedValue(makeInitResponse()),
    getProviderStatus: vi.fn().mockResolvedValue(makeProviderStatus()),
    activateProvider: vi.fn().mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    deleteProviderCredentials: vi.fn().mockResolvedValue({ deleted: true }),
    ...overrides,
  } as any;
}

// Consumer component that exposes context values for assertions
function ConfigConsumer() {
  const data = useConfigData();
  const actions = useConfigActions();

  return (
    <div>
      <span data-testid="provider">{data.provider ?? "none"}</span>
      <span data-testid="model">{data.model ?? "none"}</span>
      <span data-testid="isConfigured">{String(data.isConfigured)}</span>
      <span data-testid="isLoading">{String(actions.isLoading)}</span>
      <span data-testid="isSaving">{String(actions.isSaving)}</span>
      <span data-testid="error">{actions.error ?? "none"}</span>
      <span data-testid="projectId">{data.projectId ?? "none"}</span>
      <button data-testid="activate" onClick={() => actions.activateProvider("gemini", "gemini-2.5-pro")}>
        activate
      </button>
      <button data-testid="save" onClick={() => actions.saveCredentials("gemini", "sk-key", "gemini-2.5-flash")}>
        save
      </button>
      <button data-testid="delete" onClick={() => actions.deleteProviderCredentials("gemini")}>
        delete
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

  it("should fetch config on initial mount", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(mockApi.loadInit).toHaveBeenCalledOnce();
    expect(screen.getByTestId("provider").textContent).toBe("gemini");
    expect(screen.getByTestId("model").textContent).toBe("gemini-2.5-flash");
    expect(screen.getByTestId("projectId").textContent).toBe("proj-1");
  });

  it("should set isConfigured=true when setup status says configured", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(screen.getByTestId("isConfigured").textContent).toBe("true");
  });

  it("should set isConfigured=false when no provider configured", async () => {
    mockApi.loadInit.mockResolvedValue(
      makeInitResponse({
        config: null,
        setup: makeSetupStatus({ isConfigured: false, hasProvider: false, hasModel: false }),
      }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(screen.getByTestId("isConfigured").textContent).toBe("false");
    expect(screen.getByTestId("provider").textContent).toBe("none");
  });

  it("should set error when loadInit fails", async () => {
    mockApi.loadInit.mockRejectedValue(new Error("Server down"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(screen.getByTestId("error").textContent).toBe("Server down");
  });

  it("should show loading state initially", async () => {
    mockApi.loadInit.mockReturnValue(new Promise(() => {}));
    mockApi.getProviderStatus.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByTestId("isLoading").textContent).toBe("true");
  });

  it("should call activateProvider and refresh state", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("activate").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("isSaving").textContent).toBe("false");
    });

    expect(mockApi.activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
  });

  it("should call saveConfig and refresh state on saveCredentials", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("save").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("isSaving").textContent).toBe("false");
    });

    expect(mockApi.saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: "sk-key",
      model: "gemini-2.5-flash",
    });
  });

  it("should call deleteProviderCredentials and refresh state", async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("delete").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("isSaving").textContent).toBe("false");
    });

    expect(mockApi.deleteProviderCredentials).toHaveBeenCalledWith("gemini");
  });

  it("should set error when activateProvider fails", async () => {
    mockApi.activateProvider.mockRejectedValue(new Error("Activation failed"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("activate").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("isSaving").textContent).toBe("false");
    });

    expect(screen.getByTestId("error").textContent).toBe("Activation failed");
  });

  it("should throw when useConfigData is used outside provider", () => {
    function Orphan() {
      useConfigData();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      "useConfigData must be used within a ConfigProvider",
    );
  });

  it("should throw when useConfigActions is used outside provider", () => {
    function Orphan() {
      useConfigActions();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      "useConfigActions must be used within a ConfigProvider",
    );
  });
});
