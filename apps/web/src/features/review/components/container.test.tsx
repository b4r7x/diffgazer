import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ReviewContainer } from "./container";

vi.mock("../hooks/use-lifecycle", () => ({
  extractOrchestratorStats: () => ({}),
  useReviewLifecycle: () => ({
    state: {
      steps: [],
      agents: [],
      events: [],
      issues: [],
      notices: [],
      fileProgress: { total: 0, completed: [] },
      startedAt: null,
      isStreaming: false,
      error: null,
    },
    gate: "unconfigured",
    contextSnapshot: null,
    loadingMessage: null,
    provider: undefined,
    isTransitionPending: false,
    handleCancel: vi.fn(),
    handleBack: vi.fn(),
    handleViewResults: vi.fn(),
    handleSetupProvider: vi.fn(),
    handleSwitchMode: vi.fn(),
  }),
}));

let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;

function makeModelMissingInitResponse(): InitResponse {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "openrouter" },
    providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "parallel",
    },
    configured: false,
    project: { projectId: "project-1", path: "/repo", trust: null },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: false,
      hasTrust: false,
      isConfigured: false,
      isReady: false,
      missing: ["model"],
    },
  };
}

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
  } satisfies BoundApi;
}

function renderReviewContainer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <KeyboardProvider>
              <FooterProvider>{children}</FooterProvider>
            </KeyboardProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<ReviewContainer mode="staged" />, { wrapper: Wrapper });
}

describe("ReviewContainer configuration gates", () => {
  beforeEach(() => {
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockRejectedValue(new Error("init unavailable"));
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockRejectedValue(new Error("providers unavailable"));
  });

  it("shows the retryable error gate when init and provider status both fail", async () => {
    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });
    expect(screen.queryByText("Model Required")).not.toBeInTheDocument();
  });

  it("uses valid init setup data when only provider status fails", async () => {
    mockLoadInit.mockResolvedValue(makeModelMissingInitResponse());
    mockGetProviderStatus.mockRejectedValue(new Error("providers unavailable"));

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText("Model Required")).toBeInTheDocument();
    });
    expect(screen.queryByText("Configuration Unavailable")).not.toBeInTheDocument();
  });
});
