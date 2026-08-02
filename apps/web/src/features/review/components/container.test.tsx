import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import {
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
} from "@/testing/configuration-fixtures";
import { expectSingleReticle } from "@/testing/reticle";
import { ReviewContainer } from "./container";

const mockUseReviewLifecycle = vi.fn();

vi.mock("../hooks/use-lifecycle", () => ({
  useReviewLifecycle: (...args: unknown[]) => mockUseReviewLifecycle(...args),
}));

let mockLoadConfigurationInit: Mock<BoundApi["loadConfigurationInit"]>;

function createTestApi(init = makeReadyInitResponse()): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadConfigurationInit: mockLoadConfigurationInit,
    listConfigurations: vi.fn().mockResolvedValue({
      schemaVersion: 2,
      configurations: init.configurations,
      selectedConfigurationId: init.selectedConfigurationId,
    }),
    inspectConfiguration: vi.fn(),
    selectConfiguration: vi.fn(),
    testConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    deleteConfiguration: vi.fn(),
    executeConfigurationAction: vi.fn(),
    createConfiguration: vi.fn(),
  } satisfies BoundApi;
}

function renderReviewContainer(props: Partial<ComponentProps<typeof ReviewContainer>> = {}) {
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

  return render(<ReviewContainer mode="staged" {...props} />, { wrapper: Wrapper });
}

describe("ReviewContainer configuration gates", () => {
  beforeEach(() => {
    mockLoadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockRejectedValue(new Error("init unavailable"));
    mockUseReviewLifecycle.mockReturnValue({
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
      readiness: configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable")
        .readiness,
      selectedConfiguration: LOCAL_OPENAI_CONFIGURATION,
      isTransitionPending: false,
      handleCancel: vi.fn(),
      handleBack: vi.fn(),
      handleViewResults: vi.fn(),
      handleSetupProvider: vi.fn(),
      handleSwitchMode: vi.fn(),
    });
  });

  it("shows the retryable error gate when configuration init fails", async () => {
    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });
    expect(screen.queryByText(/Configuration Not Ready/i)).not.toBeInTheDocument();
  });

  it("shows the readiness gate with the generic action label", async () => {
    const readiness = configurationStatus(
      LOCAL_OPENAI_CONFIGURATION,
      "local-endpoint-unreachable",
    ).readiness;
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
      ]),
    );
    mockUseReviewLifecycle.mockReturnValue({
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
      readiness,
      selectedConfiguration: LOCAL_OPENAI_CONFIGURATION,
      isTransitionPending: false,
      handleCancel: vi.fn(),
      handleBack: vi.fn(),
      handleViewResults: vi.fn(),
      handleSetupProvider: vi.fn(),
      handleSwitchMode: vi.fn(),
    });

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready \(local-openai\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Test readiness" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("brackets exactly one pane on the rendered gate", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
      ]),
    );
    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    expectSingleReticle(container);
  });

  it("renders a safe terminal receipt without raw diagnostics", () => {
    const { container } = renderReviewContainer({
      terminalOutcome: "transport-failed",
      usageAvailability: "unavailable",
      onBack: vi.fn(),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Transport Failed");
    expect(screen.getByText(/Usage unavailable/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Bearer\s+/i);
    expect(container.textContent).not.toMatch(/\/Users\//);
  });

  it("exposes no secret values in the rendered gate DOM", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
      ]),
    );
    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    expect(container.textContent).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/i);
    expect(container.textContent).not.toMatch(new RegExp(LEGACY_V1_HAS_API_KEY_PROPERTY, "i"));
    expect(container.innerHTML).not.toContain("provider-status");
  });
});
