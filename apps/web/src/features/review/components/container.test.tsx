import { type BoundApi, createApi } from "@diffgazer/core/api";
import {
  ApiProvider,
  type UseReviewLifecycleBaseOptions,
  type UseReviewLifecycleBaseResult,
} from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { createInitialReviewState } from "@diffgazer/core/review";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
  selectedIdentityFrom,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

const { mockNavigate, mockUseReviewLifecycleBase, routeParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReviewLifecycleBase:
    vi.fn<(options: UseReviewLifecycleBaseOptions) => UseReviewLifecycleBaseResult>(),
  routeParams: {} as { reviewId?: string },
}));

// Boundary mock: the router is the external route context the review lifecycle
// reads its reviewId from and navigates through.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
}));

// Boundary mock: api/hooks owns the HTTP/SSE stream. Everything above it — the
// real useReviewLifecycle composition and the real configuration load — runs, so
// the arguments the container hands the lifecycle and the phase shape it consumes
// are exercised here rather than fabricated.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return { ...actual, useReviewLifecycleBase: mockUseReviewLifecycleBase };
});

import { ReviewContainer } from "./container";

let mockLoadConfigurationInit: Mock<BoundApi["loadConfigurationInit"]>;

function makeLifecycleBaseReturn(
  overrides: Partial<UseReviewLifecycleBaseResult> = {},
): UseReviewLifecycleBaseResult {
  return {
    stream: {
      state: { ...createInitialReviewState(), reviewId: null, hasCompleted: false, notices: [] },
      abort: vi.fn(),
      cancel: vi.fn().mockResolvedValue(null),
      resume: vi.fn().mockResolvedValue(undefined),
    },
    checks: {
      isNoDiffError: false,
      isTerminalStreamError: false,
      isCheckingForChanges: false,
      loadingMessage: null,
    },
    completion: {
      isCompleting: false,
      completedAt: null,
      skipDelay: vi.fn(),
      resetCompletion: vi.fn(),
    },
    start: {
      hasStarted: true,
      hasStreamed: false,
      canStart: false,
      identity: null,
      readinessGate: "unreachable",
    },
    reset: vi.fn(),
    gate: "unconfigured",
    contextSnapshot: null,
    ...overrides,
  };
}

function createTestApi(): BoundApi {
  const init = makeReadyInitResponse();
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

function unreachableLocalInit() {
  return makeConfigurationInitResponse([
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
  ]);
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
    routeParams.reviewId = undefined;
    mockNavigate.mockReset();
    mockLoadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockRejectedValue(new Error("init unavailable"));
    mockUseReviewLifecycleBase.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeLifecycleBaseReturn());
  });

  it("shows the retryable error gate when configuration init fails", async () => {
    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });
    expect(screen.queryByText(/Configuration Not Ready/i)).not.toBeInTheDocument();
  });

  it("shows the readiness gate with the generic action label", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreachableLocalInit());

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready \(local-openai\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Test readiness" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("hands the selected configuration and its readiness to the review lifecycle", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreachableLocalInit());
    routeParams.reviewId = "review-1";
    let capturedOptions: UseReviewLifecycleBaseOptions | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return makeLifecycleBaseReturn();
    });

    renderReviewContainer({ allowResumeWithoutSetup: true });

    await waitFor(() => {
      expect(capturedOptions?.configLoading).toBe(false);
    });
    expect(capturedOptions?.readiness?.status).toBe("local-endpoint-unreachable");
    expect(capturedOptions?.configuration).toEqual(
      selectedIdentityFrom(LOCAL_OPENAI_CONFIGURATION),
    );
    expect(capturedOptions?.isConfigured).toBe(true);
    expect(capturedOptions?.allowResumeWithoutSetup).toBe(true);
    expect(capturedOptions?.reviewId).toBe("review-1");
  });

  it("rests without corner brackets — a configuration gate is not a focus target", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreachableLocalInit());

    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    // Panel's data attributes are the bracket contract: the viewfinder frame
    // draws resting corners, data-state="focused" draws the focused ones.
    expect(container.querySelector('[data-frame="viewfinder"]')).toBeNull();
    expect(container.querySelector('[data-slot="panel"][data-state="focused"]')).toBeNull();
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
    mockLoadConfigurationInit.mockResolvedValue(unreachableLocalInit());

    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    expect(container.textContent).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/i);
    expect(container.textContent).not.toMatch(new RegExp(LEGACY_V1_HAS_API_KEY_PROPERTY, "i"));
    expect(container.innerHTML).not.toContain("provider-status");
  });
});
