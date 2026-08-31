import { type BoundApi, createApi } from "@diffgazer/core/api";
import {
  ApiProvider,
  type UseReviewLifecycleBaseOptions,
  type UseReviewLifecycleBaseResult,
} from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import {
  CONFIGURE_PROVIDER_LABEL,
  createInitialReviewState,
  type ReviewStateErrorCode,
} from "@diffgazer/core/review";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
  OPENCODE_GO_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

const { mockNavigate, mockUseReviewLifecycleBase, routeParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReviewLifecycleBase:
    vi.fn<(options: UseReviewLifecycleBaseOptions) => UseReviewLifecycleBaseResult>(),
  routeParams: {} as { reviewId?: string },
}));

// Boundary mock: the router is the external route context the review lifecycle
// reads its reviewId from and navigates through. Navigate records like the
// imperative form so redirect renders stay assertable.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
  Navigate: (options: Record<string, unknown>) => {
    mockNavigate(options);
    return null;
  },
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
let mockCreateReview: Mock<BoundApi["createReview"]>;

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
    createReview: mockCreateReview,
  } satisfies BoundApi;
}

function unreadyInit() {
  return makeConfigurationInitResponse([
    configurationStatus(GEMINI_CONFIGURATION, "conformance-failed"),
  ]);
}

function makeStreamFailure(options: {
  error: string;
  errorCode: ReviewStateErrorCode | null;
  lensStats?: LensStat[];
  isStreaming?: boolean;
  issues?: ReviewIssue[];
}) {
  return makeReviewLifecycleBase({
    gate: "terminal-error",
    stream: {
      state: {
        ...createInitialReviewState(),
        reviewId: "review-1",
        hasCompleted: false,
        notices: [],
        error: options.error,
        errorCode: options.errorCode,
        issues: options.issues ?? [],
        isStreaming: options.isStreaming ?? false,
        orchestratorStats: { lensStats: options.lensStats ?? [] },
      },
      abort: vi.fn(),
      cancel: vi.fn().mockResolvedValue(null),
      resume: vi.fn().mockResolvedValue(undefined),
      isStreamControllerActive: vi.fn().mockReturnValue(false),
    },
    checks: {
      isNoDiffError: false,
      isTerminalStreamError: true,
      loadingMessage: null,
    },
  });
}

const SAVED_RUN_LENS_STATS: LensStat[] = [
  { lensId: "correctness", issueCount: 1, status: "success" },
  { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
];

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
              <ProviderConsentProvider>
                <FooterProvider>{children}</FooterProvider>
              </ProviderConsentProvider>
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
    mockCreateReview = vi.fn<BoundApi["createReview"]>();
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ gate: "unconfigured", start: { canStart: false } }),
    );
  });

  it("replaces the dead live screen with the gate card, no raw diagnostics", async () => {
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({ error: "Bearer sk-live-secret-12345678", errorCode: null }),
    );

    const { container } = renderReviewContainer();

    expect(await screen.findByRole("heading", { name: "Review Error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();
    // Nothing of the live layout survives: the stream that fed it is over.
    expect(screen.queryByRole("region", { name: "Progress" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Live Activity Log" })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sk-live-secret/i);
  });

  it("leads the gate card with the providers jump when the guidance can repair it", async () => {
    const user = userEvent.setup();
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({ error: "The API key was rejected.", errorCode: "API_KEY_MISSING" }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("heading", { name: "API Key Error" })).toBeInTheDocument();
    expect(screen.getByText("The API key was rejected.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Progress" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/settings/providers" }),
      );
    });
  });

  it("routes Change model straight into the model dialog on the providers screen", async () => {
    const user = userEvent.setup();
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Adapter response failed schema validation.",
        errorCode: "MODEL_INCOMPATIBLE",
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("heading", { name: "Model Incompatible" })).toBeInTheDocument();
    // The fail-fast memo sentence travels only on memo-class failures from the
    // server, never in static screen copy.
    expect(
      screen.getByText(
        "This model could not produce Diffgazer's structured review output. Change the model or update the configuration.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change model" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/settings/providers",
          search: expect.objectContaining({ intent: "select-model" }),
        }),
      );
    });
  });

  it("opens the saved run itself once a failure that got a lens out settles", async () => {
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: "BUDGET_EXHAUSTED",
        lensStats: SAVED_RUN_LENS_STATS,
      }),
    );

    const { rerender } = renderReviewContainer();

    // Non-live: the saved record is the single account of what the run
    // produced, and it replaces the dead progress screen without a keypress.
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "review-1" },
        search: { mode: "staged" },
        replace: true,
      });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    rerender(<ReviewContainer mode="staged" />);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps the streamed findings and offers the saved run when the session is terminated", async () => {
    const user = userEvent.setup();
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Review session cancelled because repository state changed.",
        errorCode: "SESSION_STALE",
        issues: [makeIssue({ title: "Subtraction used in addition helper" })],
      }),
    );

    renderReviewContainer();

    // The run is over, but what it streamed is the point: the live layout stays
    // and the banner explains what ended it.
    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session Expired" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Saved Run" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "review-1" },
        search: { mode: "staged" },
        replace: true,
      });
    });
  });

  it("withholds the saved run when a terminated session streamed no issues", async () => {
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    // The server writes no partial run for a session that produced nothing, so
    // the banner explains the ending and offers no record to open.
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Review session cancelled because repository state changed.",
        errorCode: "SESSION_STALE",
        issues: [],
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("heading", { name: "Session Expired" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Saved Run" })).not.toBeInTheDocument();
  });

  it("stays on the live screen with Retry when the stream drops mid-run", async () => {
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "The review stream was interrupted.",
        errorCode: "STREAM_ERROR",
        lensStats: SAVED_RUN_LENS_STATS,
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps the live screen when the cancel request itself fails", async () => {
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    // A cancel that never reached the server says nothing about the run, so it
    // is coded as transport and keeps its Retry instead of a terminal gate.
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Failed to cancel the review session.",
        errorCode: "STREAM_ERROR",
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review Error" })).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("leaves a still-running stream on the progress screen", async () => {
    routeParams.reviewId = "review-1";
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReturnValue(
      makeStreamFailure({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: "BUDGET_EXHAUSTED",
        lensStats: SAVED_RUN_LENS_STATS,
        isStreaming: true,
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows the retryable error gate when configuration init fails", async () => {
    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });
    expect(screen.queryByText(/Configuration Not Ready/i)).not.toBeInTheDocument();
  });

  it("routes the error gate's Configure Provider action to provider settings", async () => {
    const user = userEvent.setup();
    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });

    await user.click(screen.getByRole("button", { name: "Configure Provider" }));

    await waitFor(() => {
      // The configuration never loaded, so there is no product to deep-link.
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings/providers", search: {} });
    });
  });

  it("names the session-token mismatch and drops Configure Provider when init fails with 401", async () => {
    mockLoadConfigurationInit.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" }),
    );

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Session Not Authorized");
    });
    // Provider setup cannot fix a token mismatch, so the gate offers Retry alone.
    expect(screen.queryByRole("button", { name: "Configure Provider" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("shows the retryable error gate when the selection no longer resolves to a configuration", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([configurationStatus(GEMINI_CONFIGURATION, "ready")], null),
    );

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    });
    expect(screen.queryByRole("region", { name: "Progress" })).not.toBeInTheDocument();
  });

  it("names the readiness gate action for where it goes, beside the product's real name", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreadyInit());

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready \(Google Gemini\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toBeInTheDocument();
    });
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("redirects a fresh install to onboarding instead of any error gate", async () => {
    mockLoadConfigurationInit.mockResolvedValue(makeConfigurationInitResponse([], null));

    renderReviewContainer();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/onboarding", replace: true }),
      );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Configuration Unavailable/)).not.toBeInTheDocument();
  });

  it("renders the calm reconnect state for a rejected credential, metadata preserved", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(GEMINI_CONFIGURATION, "credential-invalid"),
      ]),
    );

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reconnect Provider" })).toBeInTheDocument();
    });
    // Warning tone, never the alarm gate: no alert role and no error copy.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Configuration Unavailable/)).not.toBeInTheDocument();
    // The configuration's identity survives the broken credential.
    expect(screen.getByText("Google Gemini / Gemini 2.5 Flash")).toBeInTheDocument();
    expect(screen.getByText(/missing or was rejected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter API Key" })).toBeInTheDocument();
  });

  it("names the bound billing pool on a Go configuration's gate, never the product", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(OPENCODE_GO_CONFIGURATION, "conformance-failed"),
      ]),
    );

    renderReviewContainer();

    // The shell header already reads "OpenCode · Go" for this configuration; the
    // review screen is live too, so it must not name the other wallet.
    expect(
      await screen.findByText(/Configuration Not Ready \(OpenCode · Go\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("OpenCode · Go / DeepSeek V4 Flash")).toBeInTheDocument();
    expect(screen.queryByText(/OpenCode Zen/)).not.toBeInTheDocument();
  });

  it("deep-links Enter API Key to the affected product on the providers screen", async () => {
    const user = userEvent.setup();
    mockLoadConfigurationInit.mockResolvedValue(
      makeConfigurationInitResponse([
        configurationStatus(GEMINI_CONFIGURATION, "credential-invalid"),
      ]),
    );

    renderReviewContainer();

    await user.click(await screen.findByRole("button", { name: "Enter API Key" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/settings/providers",
        search: { product: "gemini" },
      });
    });
  });

  it("hands selected readiness to the review lifecycle", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreadyInit());
    routeParams.reviewId = "review-1";
    let capturedOptions: UseReviewLifecycleBaseOptions | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return makeReviewLifecycleBase({ gate: "unconfigured", start: { canStart: false } });
    });

    renderReviewContainer({ allowResumeWithoutSetup: true });

    await waitFor(() => {
      expect(capturedOptions?.configLoading).toBe(false);
    });
    expect(capturedOptions?.readiness?.status).toBe("conformance-failed");
    expect(capturedOptions?.allowResumeWithoutSetup).toBe(true);
    expect(capturedOptions?.reviewId).toBe("review-1");
  });

  it("wears the focused reticle while the configuration gate holds mount focus", async () => {
    mockLoadConfigurationInit.mockResolvedValue(unreadyInit());

    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    // Panel's data attributes are the bracket contract: the frame itself stays
    // at rest (never the viewfinder), and data-state="focused" tracks the real
    // focus the gate's action row takes on mount.
    expect(container.querySelector('[data-frame="viewfinder"]')).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
    });
    expect(container.querySelector('[data-slot="panel"]')).toHaveAttribute("data-state", "focused");
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
    mockLoadConfigurationInit.mockResolvedValue(unreadyInit());

    const { container } = renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByText(/Configuration Not Ready/i)).toBeInTheDocument();
    });

    expect(container.textContent).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/i);
    expect(container.textContent).not.toMatch(new RegExp(LEGACY_V1_HAS_API_KEY_PROPERTY, "i"));
    expect(container.innerHTML).not.toContain("provider-status");
  });
});

describe("ReviewContainer review start", () => {
  beforeEach(() => {
    routeParams.reviewId = "review-1";
    mockNavigate.mockReset();
    mockLoadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeReadyInitResponse());
    mockUseReviewLifecycleBase.mockReset();
    mockCreateReview = vi.fn<BoundApi["createReview"]>();
  });

  it("draws the review surface while the admitted run is starting", async () => {
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "loading",
        checks: {
          isNoDiffError: false,
          isTerminalStreamError: false,
          loadingMessage: "Checking for changes...",
        },
        start: { hasStarted: false, canStart: true },
      }),
    );

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toBeInTheDocument();
    // Every step the run is about to walk is already on screen, so nothing is
    // rebuilt when the first event lands.
    expect(screen.getByText("Collect diff")).toBeInTheDocument();
    expect(screen.getByText("Generate report")).toBeInTheDocument();
    expect(screen.queryByText("Checking for changes...")).not.toBeInTheDocument();
  });

  it("opens a run the create call answered on the no-changes view, never on the progress frame", async () => {
    // The admitted-outcome case: the run still looks freshly started — nothing
    // has streamed — so only the gate keeps the progress frame off the screen.
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        checks: { isNoDiffError: true, isTerminalStreamError: false, loadingMessage: null },
        start: { hasStarted: false, canStart: true },
      }),
    );

    renderReviewContainer();

    expect(await screen.findByRole("button", { name: "Review Unstaged" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Progress" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Live Activity Log" })).not.toBeInTheDocument();
  });

  it("renders an admission fast-fail from the alternate-mode start inline with the providers jump", async () => {
    const user = userEvent.setup();
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        checks: { isNoDiffError: true, isTerminalStreamError: false, loadingMessage: null },
        stream: {
          cancel: vi.fn().mockResolvedValue({ status: "cancelled", reason: "cancelled" }),
        },
      }),
    );
    mockCreateReview.mockRejectedValue(
      Object.assign(new Error("The selected model failed structured output."), {
        code: "SETUP_REQUIRED",
        status: 403,
      }),
    );

    renderReviewContainer();

    await user.click(await screen.findByRole("button", { name: "Review Unstaged" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration Needs Attention");
    expect(screen.getByText("The selected model failed structured output.")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Open Providers" }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/settings/providers" }),
      );
    });
  });

  it("keeps the plain readout while configuration is still unresolved", async () => {
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "loading",
        checks: {
          isNoDiffError: false,
          isTerminalStreamError: false,
          loadingMessage: "Loading configuration...",
        },
        start: { hasStarted: false, canStart: false },
      }),
    );

    renderReviewContainer();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Loading configuration...");
    });
    expect(screen.queryByRole("region", { name: "Progress" })).not.toBeInTheDocument();
  });
});
