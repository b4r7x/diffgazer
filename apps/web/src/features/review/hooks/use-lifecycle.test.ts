import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider, useReview } from "@diffgazer/core/api/hooks";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  makeCreateReviewResponse,
  makeIssue,
  makeReviewMetadata,
} from "@diffgazer/core/testing/factories";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";

const {
  mockNavigate,
  mockCreateReview,
  mockUseReviewLifecycleBase,
  mockToastError,
  mockClearActiveSession,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
  mockToastError: vi.fn(),
  mockClearActiveSession: vi.fn(),
}));

// Boundary mock: external library (@diffgazer/ui) toast side-effect contract.
vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: { error: mockToastError },
}));

// Boundary mock: TanStack Router is the external routing library; this hook asserts navigation requests.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reviewId: "11111111-1111-4111-8111-111111111111" }),
}));

// Boundary mock: core api hooks wrap fetch-backed API calls and stream lifecycle.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@diffgazer/core/api/hooks")>(
    "@diffgazer/core/api/hooks",
  );
  return {
    ...actual,
    useReviewLifecycleBase: mockUseReviewLifecycleBase,
    useReviewSessionCache: () => ({
      clearActiveSession: mockClearActiveSession,
    }),
  };
});

import { useReviewLifecycle } from "./use-lifecycle";

type CancelReviewOutcome =
  | { status: "cancelled"; reason: "cancelled" }
  | { status: "error"; message: string };

let queryClient: QueryClient;
let mockApi: BoundApi;

beforeEach(() => {
  mockClearActiveSession.mockReset();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  mockApi = createMockApi();
});

afterEach(() => {
  queryClient.clear();
});

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      ApiProvider,
      { value: mockApi },
      createElement(
        ConfigProvider,
        null,
        createElement(
          KeyboardProvider,
          null,
          createElement(ProviderConsentProvider, null, children),
        ),
      ),
    ),
  );
}

function renderReviewLifecycle(mode: ReviewMode) {
  return renderHook(() => useReviewLifecycle({ mode }), { wrapper: Wrapper });
}

/**
 * The no-diff switch is reached with the configuration loaded, so these render
 * past the initial fetch: switching before it would meet the provider consent
 * gate, which cannot see the recorded consent until the settings arrive.
 */
async function renderLoadedReviewLifecycle(mode: ReviewMode) {
  const view = renderReviewLifecycle(mode);
  await waitFor(() => expect(view.result.current.selectedConfiguration).not.toBeNull());
  return view;
}

function makeBaseReturn() {
  return {
    stream: {
      abort: vi.fn(),
      cancel: vi.fn(
        async (): Promise<CancelReviewOutcome | null> => ({
          status: "cancelled",
          reason: "cancelled",
        }),
      ),
      resume: vi.fn(),
      state: {
        steps: [],
        agents: [],
        issues: [],
        events: [],
        fileProgress: { total: 0, completed: [] },
        isStreaming: false,
        error: "No unstaged changes found" as string | null,
        errorCode: ReviewErrorCode.NO_DIFF as string | null,
        startedAt: null,
        reviewId: "11111111-1111-4111-8111-111111111111",
      },
    },
    checks: {
      loadingMessage: null,
      isNoDiffError: true,
      isTerminalStreamError: false,
    },
    completion: {
      isCompleting: false,
      completedAt: null,
      skipDelay: vi.fn(),
    },
    start: {
      hasStarted: true,
      canStart: true,
    },
    gate: "no-diff" as const,
    contextSnapshot: null,
    contextRefreshError: null,
    retryContextRefresh: vi.fn(),
    resumeReview: vi.fn(),
    reset: vi.fn(),
  };
}

function makeRunningBaseReturn() {
  const base = makeBaseReturn();
  base.stream.state.error = null;
  base.stream.state.errorCode = null;
  base.checks.isNoDiffError = false;
  return base;
}

describe("useReviewLifecycle no-diff alternate start", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeBaseReturn());
    mockCreateReview.mockImplementation(async ({ mode }: { mode: ReviewMode }) =>
      makeCreateReviewResponse({
        reviewId: "22222222-2222-4222-8222-222222222222",
        session: { mode },
      }),
    );
  });

  it.each<[ReviewMode, ReviewMode]>([
    ["unstaged", "staged"],
    ["staged", "unstaged"],
    ["files", "unstaged"],
  ])("starts the alternate %s review instead of navigating home from %s", async (mode, alternateMode) => {
    const { result } = await renderLoadedReviewLifecycle(mode);

    result.current.handleSwitchMode();

    await waitFor(() => {
      expect(mockCreateReview).toHaveBeenCalledWith({ mode: alternateMode });
    });
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      mode,
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
      search: { mode: alternateMode, live: true },
      replace: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
  });

  it.each([
    [
      "API_KEY_MISSING",
      "API key not found",
      {
        title: "API Key Missing",
        message: "API key not found. Add one in Settings → Providers.",
        recovery: "configure-provider",
      },
    ],
    [
      "SETUP_REQUIRED",
      "The selected model failed structured output. Select a different model.",
      {
        title: "Configuration Needs Attention",
        message: "The selected model failed structured output. Select a different model.",
        recovery: "configure-provider",
      },
    ],
    [
      "REVIEW_IN_PROGRESS",
      "busy",
      {
        title: "Review Already Running",
        message:
          "A review is already running for this configuration. Diffgazer runs one review at a time, so a new one cannot start until the running review finishes or is cancelled.",
        recovery: "open-active-review",
      },
    ],
  ])("holds a %s start failure as review-screen state instead of a toast when the alternate review cannot be created", async (code, message, startError) => {
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "cancelled",
        reason: "cancelled",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockRejectedValue(
      Object.assign(new Error(message), { code, status: code === "SETUP_REQUIRED" ? 403 : 400 }),
    );

    const { result } = await renderLoadedReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());

    await waitFor(() => {
      expect(result.current.startError).toEqual(startError);
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.isTransitionPending).toBe(false);
  });

  it("clears the start failure while a retried mode switch is pending", async () => {
    const created = createDeferred<ReturnType<typeof makeCreateReviewResponse>>();
    mockCreateReview
      .mockRejectedValueOnce(
        Object.assign(new Error("API key not found"), { code: "API_KEY_MISSING", status: 400 }),
      )
      .mockReturnValueOnce(created.promise);

    const { result } = await renderLoadedReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(result.current.startError).not.toBeNull());

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(2));
    expect(result.current.startError).toBeNull();
    expect(result.current.isTransitionPending).toBe(true);

    created.resolve(
      makeCreateReviewResponse({
        reviewId: "22222222-2222-4222-8222-222222222222",
        session: { mode: "staged" },
      }),
    );
    await act(async () => created.promise);

    expect(result.current.startError).toBeNull();
    expect(result.current.isTransitionPending).toBe(false);
  });

  it("asks for the provider consent before the alternate review and starts it once accepted", async () => {
    const user = userEvent.setup();
    const init = makeReadyInitResponse();
    init.settings.providerConsent = null;
    mockApi = createMockApi(init);
    mockApi.saveSettings = vi.fn(async (patch) => {
      Object.assign(init.settings, patch);
    });
    const { result } = await renderLoadedReviewLifecycle("staged");

    act(() => result.current.handleSwitchMode());

    const dialog = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    expect(mockCreateReview).not.toHaveBeenCalled();
    // The no-diff screen is untouched behind the notice: nothing was cancelled yet.
    expect(result.current.isTransitionPending).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Accept and continue" }));

    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledWith({ mode: "unstaged" }));
    expect(mockApi.saveSettings).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });
  });

  it("clears the active session when the review reaches no-diff", async () => {
    renderReviewLifecycle("unstaged");

    await waitFor(() => {
      expect(mockClearActiveSession).toHaveBeenCalledWith(
        "unstaged",
        "11111111-1111-4111-8111-111111111111",
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("makes Back authoritative while alternate cancellation is pending", async () => {
    const cancel = createDeferred<CancelReviewOutcome | null>();
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(() => cancel.promise);
    mockUseReviewLifecycleBase.mockReturnValue(base);
    const { result } = await renderLoadedReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(base.stream.cancel).toHaveBeenCalledTimes(1));

    act(() => result.current.handleCancel());
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(result.current.isTransitionPending).toBe(false);

    cancel.resolve({ status: "cancelled", reason: "cancelled" });
    await act(async () => cancel.promise);
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it("keeps a late alternate session resumable when Back wins after creation starts", async () => {
    const created = createDeferred<ReturnType<typeof makeCreateReviewResponse>>();
    const response = makeCreateReviewResponse({
      reviewId: "22222222-2222-4222-8222-222222222222",
      session: { mode: "staged" },
    });
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "cancelled",
        reason: "cancelled",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const { result } = await renderLoadedReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));

    act(() => result.current.handleCancel());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: "/" }));

    created.resolve(response);
    await act(async () => created.promise);

    await waitFor(() => {
      expect(queryClient.getQueryData(["review", "active-session", "staged"])).toEqual({
        session: response.session,
      });
    });
    await waitFor(() => {
      const mutations = queryClient.getMutationCache().getAll();
      expect(mutations).toHaveLength(1);
      expect(mutations[0]?.state.status).toBe("success");
    });
    await act(async () => Promise.resolve());

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}" }),
    );
  });

  it("exposes the pending transition until alternate creation settles", async () => {
    const created = createDeferred<ReturnType<typeof makeCreateReviewResponse>>();
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "cancelled",
        reason: "cancelled",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const { result } = await renderLoadedReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
    expect(result.current.isTransitionPending).toBe(true);

    created.resolve(
      makeCreateReviewResponse({
        reviewId: "22222222-2222-4222-8222-222222222222",
        session: { mode: "staged" },
      }),
    );
    await act(async () => created.promise);

    expect(result.current.isTransitionPending).toBe(false);
  });

  it("invalidates alternate navigation when the owner unmounts", async () => {
    const created = createDeferred<ReturnType<typeof makeCreateReviewResponse>>();
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "cancelled",
        reason: "cancelled",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const view = await renderLoadedReviewLifecycle("unstaged");

    act(() => view.result.current.handleSwitchMode());
    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
    view.unmount();

    created.resolve(
      makeCreateReviewResponse({
        reviewId: "22222222-2222-4222-8222-222222222222",
        session: { mode: "staged" },
      }),
    );
    await act(async () => created.promise);

    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}" }),
    );
  });
});

describe("useReviewLifecycle Back from terminal screens", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
  });

  it("navigates home on Back from the error/no-changes screen without a Cancel failed toast", async () => {
    // Terminal no-diff: cancel returns a success-shaped outcome; Back navigates home
    // without showing "Cancel failed".
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "cancelled",
        reason: "cancelled",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleCancel();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("reports a rejected cancel instead of leaving the user on a dead button", async () => {
    const base = makeRunningBaseReturn();
    base.stream.cancel = vi.fn(async () => {
      throw new Error("Network request failed");
    });
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    act(() => result.current.handleCancel());

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cancel failed", {
        message: "Network request failed",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.isTransitionPending).toBe(false);
  });

  it("reports a structured cancel error instead of leaving the user on a dead button", async () => {
    const base = makeRunningBaseReturn();
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "error",
        message: "cancel endpoint down",
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    act(() => result.current.handleCancel());

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cancel failed", {
        message: "cancel endpoint down",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearActiveSession).not.toHaveBeenCalled();
    expect(result.current.isTransitionPending).toBe(false);
  });

  it("sanitizes untrusted cancel failures before reporting them", async () => {
    const base = makeRunningBaseReturn();
    const unsafe = "Bearer sk-live-secret /Users/voitz/.config/codex correlationId=abc";
    base.stream.cancel = vi.fn(
      async (): Promise<CancelReviewOutcome | null> => ({
        status: "error",
        message: unsafe,
      }),
    );
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    act(() => result.current.handleCancel());

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cancel failed", {
        message:
          "Diffgazer could not present this failure safely. Return home and retry the review.",
      });
    });
    expect(mockToastError.mock.calls[0]?.[1]?.message).not.toContain("Bearer");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("reports a cancel failure the user abandoned by leaving mid-cancel", async () => {
    // The review keeps running and keeps billing, so the failure must reach the
    // user even though a Back press already invalidated this transition.
    const deferred = createDeferred<CancelReviewOutcome | null>();
    const base = makeRunningBaseReturn();
    base.stream.cancel = vi.fn(() => deferred.promise);
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    act(() => result.current.handleCancel());
    act(() => result.current.handleBack());
    mockNavigate.mockClear();

    await act(async () => {
      deferred.resolve({ status: "error", message: "cancel endpoint down" });
      await deferred.promise;
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cancel failed", {
        message: "cancel endpoint down",
      });
    });
  });

  it("reports a rejected cancel from the provider-setup path", async () => {
    const base = makeRunningBaseReturn();
    base.stream.cancel = vi.fn(async () => {
      throw new Error("Network request failed");
    });
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("staged");

    act(() => result.current.handleSetupProvider());

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cancel failed", {
        message: "Network request failed",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/settings/providers" });
  });
});

describe("useReviewLifecycle Back from a running review", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
  });

  it("navigates home without cancelling the server session so it stays resumable", () => {
    const base = makeBaseReturn();
    base.stream.state.isStreaming = true;
    base.stream.state.error = null;
    base.stream.state.errorCode = null;
    base.checks.isNoDiffError = false;
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleBack();

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(base.stream.cancel).not.toHaveBeenCalled();
    expect(mockClearActiveSession).not.toHaveBeenCalled();
  });

  it("clears only the active-session cache on Back from a generic terminal stream error", () => {
    const base = makeRunningBaseReturn();
    base.stream.state.isStreaming = false;
    base.stream.state.error = "Stream failed";
    base.stream.state.errorCode = "STREAM_ERROR";
    base.checks.isTerminalStreamError = true;
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleBack();

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(base.stream.cancel).not.toHaveBeenCalled();
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("useReviewLifecycle View Run Details", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseReviewLifecycleBase.mockReset();
  });

  it("opens the saved run in place of the failed live screen and drops the dead session", () => {
    const base = makeRunningBaseReturn();
    base.stream.state.isStreaming = false;
    base.stream.state.error = "Review budget exhausted at maxInputTokens (119808).";
    base.stream.state.errorCode = ReviewErrorCode.BUDGET_EXHAUSTED;
    base.checks.isTerminalStreamError = true;
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleViewRun("11111111-1111-4111-8111-111111111111");

    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    // Non-live: the saved record is the source, and it replaces the failure in
    // history rather than stacking on it.
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "11111111-1111-4111-8111-111111111111" },
      search: { mode: "unstaged" },
      replace: true,
    });
  });

  it("drops the mid-run detail cache so the saved run is read again, not served stale", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    const savedReview = {
      metadata: makeReviewMetadata({ id: reviewId }),
      gitContext: { branch: "main", commit: "abc123", fileCount: 1, additions: 0, deletions: 0 },
    };
    const getReview = vi
      .fn<BoundApi["getReview"]>()
      // Fetched while the run was still streaming: no result yet, so the screen
      // falls back to the stream that has since died.
      .mockResolvedValueOnce({ review: { ...savedReview, result: { issues: [] } } })
      .mockResolvedValue({ review: { ...savedReview, result: { issues: [makeIssue()] } } });
    mockApi.getReview = getReview;
    const base = makeRunningBaseReturn();
    base.stream.state.error = "Review budget exhausted at maxInputTokens (119808).";
    base.stream.state.errorCode = ReviewErrorCode.BUDGET_EXHAUSTED;
    base.checks.isTerminalStreamError = true;
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderHook(
      () => ({
        lifecycle: useReviewLifecycle({ mode: "unstaged" }),
        saved: useReview(reviewId),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.saved.data?.review.result.issues).toEqual([]));

    act(() => result.current.lifecycle.handleViewRun(reviewId));

    // The entry is still fresh by staleTime, so without dropping it the saved
    // summary would keep resolving to the dead live screen.
    await waitFor(() => expect(result.current.saved.data?.review.result.issues).toHaveLength(1));
  });
});

describe("useReviewLifecycle stream retry", () => {
  it("resumes the active review through the shared stream lifecycle", () => {
    const base = makeBaseReturn();
    mockUseReviewLifecycleBase.mockReturnValue(base);
    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleRetry("active-review");

    expect(base.resumeReview).toHaveBeenCalledWith("active-review");
  });
});

describe("useReviewLifecycle completion cache cleanup", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
  });

  it("clears the active session before emitting completion", async () => {
    const onComplete = vi.fn();
    let emitComplete: (() => void) | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      emitComplete = options.onComplete;
      const base = makeRunningBaseReturn();
      return {
        ...base,
        stream: {
          ...base.stream,
          state: {
            ...base.stream.state,
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        },
        completion: {
          ...base.completion,
          completedAt: new Date("2026-01-01T00:00:02.500Z"),
        },
      };
    });

    renderHook(() => useReviewLifecycle({ mode: "staged", onComplete }), { wrapper: Wrapper });

    await act(async () => {
      emitComplete?.();
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: "11111111-1111-4111-8111-111111111111",
        issues: [],
        durationMs: 2500,
      }),
    );
    const clearCallOrder = mockClearActiveSession.mock.invocationCallOrder[0];
    const completeCallOrder = onComplete.mock.invocationCallOrder[0];
    if (clearCallOrder === undefined || completeCallOrder === undefined) {
      throw new Error("Expected cache cleanup and completion callbacks to be called");
    }
    expect(clearCallOrder).toBeLessThan(completeCallOrder);
  });

  it("emits completion from the View Results event path", async () => {
    const onComplete = vi.fn();
    const base = makeRunningBaseReturn();
    // One stable mock across re-renders: completion now settles asynchronously,
    // so the hook re-renders before the assertions read it back.
    const skipDelay = vi.fn();
    base.completion.skipDelay = skipDelay;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      skipDelay.mockImplementation(() => options.onComplete());
      return base;
    });

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged", onComplete }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      result.current.handleViewResults();
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(skipDelay).toHaveBeenCalled();
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: "11111111-1111-4111-8111-111111111111",
        issues: [],
      }),
    );
  });

  it("attributes the completed run to its own receipt, not the current selection", async () => {
    const onComplete = vi.fn();
    let emitComplete: (() => void) | undefined;
    mockApi.getReview = vi.fn().mockResolvedValue({
      review: {
        metadata: makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
        result: { issues: [] },
        executionSnapshot: {
          schemaVersion: 1,
          executionFingerprint: "a".repeat(64),
          receipt: {
            outcome: "completed",
            usageAvailability: "reported",
            productId: "zai",
            modelId: "glm-4.6",
          },
        },
      },
    });
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      emitComplete = options.onComplete;
      return makeRunningBaseReturn();
    });

    // The selection on screen is Gemini; the run on disk was produced by Z.ai.
    const { result } = await renderLoadedReviewLifecycle("staged");
    expect(result.current.selectedConfiguration?.productId).toBe("gemini");
    renderHook(() => useReviewLifecycle({ mode: "staged", onComplete }), { wrapper: Wrapper });

    await act(async () => {
      emitComplete?.();
    });

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ productId: "zai", modelId: "glm-4.6" }),
      ),
    );
  });

  it("reports no model when the completed run's record carries no receipt", async () => {
    const onComplete = vi.fn();
    let emitComplete: (() => void) | undefined;
    mockApi.getReview = vi.fn().mockResolvedValue({
      review: {
        metadata: makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
        result: { issues: [] },
      },
    });
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      emitComplete = options.onComplete;
      return makeRunningBaseReturn();
    });

    renderHook(() => useReviewLifecycle({ mode: "staged", onComplete }), { wrapper: Wrapper });

    await act(async () => {
      emitComplete?.();
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ productId: undefined, modelId: undefined }),
    );
  });

  it("clears the active session when the stream completes before the summary delay finishes", () => {
    let emitStreamComplete: (() => void) | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      emitStreamComplete = options.onStreamComplete;
      return makeRunningBaseReturn();
    });

    renderReviewLifecycle("staged");

    act(() => {
      emitStreamComplete?.();
    });

    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("clears the active session when a resume target is not found", () => {
    let emitNotFound: ((reviewId: string) => void) | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      emitNotFound = options.onNotFoundInSession;
      return makeRunningBaseReturn();
    });

    renderReviewLifecycle("unstaged");

    act(() => {
      emitNotFound?.("11111111-1111-4111-8111-111111111111");
    });

    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("clears the active session after cancelling for provider setup", async () => {
    const base = makeRunningBaseReturn();
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("staged");

    result.current.handleSetupProvider();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/settings/providers" }),
      );
    });
    expect(base.stream.cancel).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      preserveState: true,
    });
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("deep-links provider setup to the selected configuration's product", async () => {
    const base = makeRunningBaseReturn();
    mockUseReviewLifecycleBase.mockReturnValue(base);

    const { result } = renderReviewLifecycle("staged");
    await waitFor(() => expect(result.current.selectedConfiguration).not.toBeNull());

    result.current.handleSetupProvider();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/settings/providers",
        search: { product: "gemini" },
      });
    });
  });
});

describe("useReviewLifecycle stale session termination", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeBaseReturn());
  });

  it("clears the active session without leaving the review screen or duplicating the banner copy", () => {
    let onStale: ((code: string) => void) | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      onStale = options.onStaleSession;
      return makeRunningBaseReturn();
    });

    renderReviewLifecycle("unstaged");

    act(() => {
      onStale?.(ReviewErrorCode.SESSION_TIMEOUT);
    });

    expect(mockClearActiveSession).toHaveBeenCalledOnce();
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    // The terminal-error banner on the screen owns the termination copy; a
    // toast saying the same thing would render it twice.
    expect(mockToastError).not.toHaveBeenCalled();
    // The streamed findings are still on this screen, and the server saved the
    // partial run: navigating home would throw both away.
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("useReviewLifecycle readiness gate", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
  });

  it("only starts review when readiness is ready", async () => {
    let capturedOptions: Parameters<typeof mockUseReviewLifecycleBase>[0] | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return {
        ...makeRunningBaseReturn(),
        start: {
          ...makeRunningBaseReturn().start,
          canStart: true,
        },
        gate: "running",
      };
    });

    renderReviewLifecycle("unstaged");

    await waitFor(() => {
      expect(capturedOptions?.readiness?.ready).toBe(true);
    });
  });

  it("routes conformance-failed readiness to the test action without API-key copy", async () => {
    const init = makeConfigurationInitResponse([
      configurationStatus(ZAI_CONFIGURATION, "conformance-failed"),
    ]);
    mockApi = createMockApi(init);
    let capturedOptions: Parameters<typeof mockUseReviewLifecycleBase>[0] | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return {
        ...makeRunningBaseReturn(),
        start: {
          ...makeRunningBaseReturn().start,
          canStart: false,
        },
        gate: "unconfigured",
      };
    });

    const { result } = renderReviewLifecycle("unstaged");

    await waitFor(() => {
      expect(capturedOptions?.readiness?.status).toBe("conformance-failed");
      expect(capturedOptions?.readiness?.action).toBe("test");
    });
    expect(result.current.readiness?.remediation.message).not.toMatch(/api key/i);
    expect(result.current.readiness?.status).toBe("conformance-failed");
  });

  it("routes unsupported readiness to the inspect action", async () => {
    const init = makeConfigurationInitResponse([
      configurationStatus(GEMINI_CONFIGURATION, "unsupported"),
    ]);
    mockApi = createMockApi(init);
    mockUseReviewLifecycleBase.mockReturnValue({
      ...makeRunningBaseReturn(),
      start: {
        ...makeRunningBaseReturn().start,
        canStart: false,
      },
      gate: "unconfigured",
    });

    const { result } = renderReviewLifecycle("staged");

    await waitFor(() => {
      expect(result.current.readiness?.status).toBe("unsupported");
      expect(result.current.readiness?.action).toBe("inspect");
    });
  });

  it("allows a saved completed review to resume without readiness", async () => {
    const init = makeConfigurationInitResponse([
      configurationStatus(ZAI_CONFIGURATION, "conformance-failed"),
    ]);
    mockApi = createMockApi(init);
    let capturedOptions: Parameters<typeof mockUseReviewLifecycleBase>[0] | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return {
        ...makeRunningBaseReturn(),
        start: {
          ...makeRunningBaseReturn().start,
          canStart: true,
        },
        gate: "running",
      };
    });

    renderHook(
      () =>
        useReviewLifecycle({
          mode: "staged",
          allowResumeWithoutSetup: true,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(capturedOptions?.allowResumeWithoutSetup).toBe(true);
      expect(capturedOptions?.readiness?.ready).toBe(false);
    });
  });
});

function createMockApi(init = makeReadyInitResponse()): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    createReview: mockCreateReview,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
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
  };
}
