import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, screen, cleanup } from "@testing-library/react";
import { useConfigData, useConfigActions, ConfigProvider } from "./config-provider";

// Mock api at the boundary
vi.mock("@/lib/api", () => ({
  api: {
    loadInit: vi.fn(),
    getProviderStatus: vi.fn(),
    activateProvider: vi.fn(),
    saveConfig: vi.fn(),
    deleteProviderCredentials: vi.fn(),
  },
}));

// Set TTL to 0 so module-level cache always expires between tests
vi.mock("@/config/constants", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/config/constants")>();
  return { ...orig, DEFAULT_TTL: -1 };
});

import { api } from "@/lib/api";

const mockApi = api as {
  loadInit: ReturnType<typeof vi.fn>;
  getProviderStatus: ReturnType<typeof vi.fn>;
  activateProvider: ReturnType<typeof vi.fn>;
  saveConfig: ReturnType<typeof vi.fn>;
  deleteProviderCredentials: ReturnType<typeof vi.fn>;
};

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
      { id: "gemini", name: "Gemini", hasCredentials: true, isActive: true },
    ],
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: makeSetupStatus(),
    ...overrides,
  };
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

function renderWithProvider() {
  return render(
    <ConfigProvider>
      <ConfigConsumer />
    </ConfigProvider>,
  );
}

describe("ConfigProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockApi.loadInit.mockResolvedValue(makeInitResponse());
    mockApi.getProviderStatus.mockResolvedValue([
      { id: "gemini", name: "Gemini", hasCredentials: true, isActive: true },
    ]);
    mockApi.activateProvider.mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    mockApi.saveConfig.mockResolvedValue(undefined);
    mockApi.deleteProviderCredentials.mockResolvedValue({ deleted: true });
  });

  afterEach(() => {
    cleanup();
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
        config: {},
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
    // Use a promise that never resolves to keep loading state
    mockApi.loadInit.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    // Loading should be true immediately (before any async resolution)
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
    expect(mockApi.getProviderStatus).toHaveBeenCalled();
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
    expect(mockApi.getProviderStatus).toHaveBeenCalled();
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
