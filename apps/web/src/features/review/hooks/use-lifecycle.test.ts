import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { sessionTerminationCopy } from "@diffgazer/core/review";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { REVIEW_PROGRESS_CONTROLS } from "./use-progress-keyboard";

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

describe("review progress control documentation", () => {
  it("matches the cancel and resumable-leave controls used by the progress screen", () => {
    const guide = readFileSync(
      resolve(import.meta.dirname, "../../../../../docs/content/docs/app/web/reviewing.mdx"),
      "utf8",
    );

    expect(guide).toContain(
      `press \`${REVIEW_PROGRESS_CONTROLS.cancel.key}\` or use **${REVIEW_PROGRESS_CONTROLS.cancel.label}**`,
    );
    expect(guide).toContain(
      "Press `Esc` to return to Home without stopping the run; the server session keeps running and remains resumable from Home.",
    );
    expect(REVIEW_PROGRESS_CONTROLS.leave.key).toBe("Escape");
  });
});

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
    createElement(ApiProvider, { value: mockApi }, createElement(ConfigProvider, null, children)),
  );
}

function renderReviewLifecycle(mode: ReviewMode) {
  return renderHook(() => useReviewLifecycle({ mode }), { wrapper: Wrapper });
}

function makeBaseReturn() {
  return {
    stream: {
      stop: vi.fn(),
      abort: vi.fn(),
      cancel: vi.fn(async (): Promise<string | null> => null),
      resume: vi.fn(),
      state: {
        steps: [],
        agents: [],
        issues: [],
        events: [],
        fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
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
      isCheckingForChanges: false,
    },
    completion: {
      isCompleting: false,
      completedAt: null,
      skipDelay: vi.fn(),
      resetCompletion: vi.fn(),
    },
    start: {
      hasStarted: true,
      hasStreamed: true,
      setHasStarted: vi.fn(),
      setHasStreamed: vi.fn(),
    },
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
    const { result } = renderReviewLifecycle(mode);

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
    const cancel = createDeferred<string | null>();
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(() => cancel.promise);
    mockUseReviewLifecycleBase.mockReturnValue(base);
    const { result } = renderReviewLifecycle("unstaged");

    act(() => result.current.handleSwitchMode());
    await waitFor(() => expect(base.stream.cancel).toHaveBeenCalledTimes(1));

    act(() => result.current.handleCancel());
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(result.current.isTransitionPending).toBe(false);

    cancel.resolve(null);
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
    base.stream.cancel = vi.fn(async () => null);
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const { result } = renderReviewLifecycle("unstaged");

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
    base.stream.cancel = vi.fn(async () => null);
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const { result } = renderReviewLifecycle("unstaged");

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
    base.stream.cancel = vi.fn(async () => null);
    mockUseReviewLifecycleBase.mockReturnValue(base);
    mockCreateReview.mockReturnValue(created.promise);
    const view = renderReviewLifecycle("unstaged");

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
    // The terminal session now answers cancel success-shaped, so cancelOnServer
    // resolves null and Back must navigate home, never toast "Cancel failed".
    const base = makeBaseReturn();
    base.stream.cancel = vi.fn(async () => null);
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

describe("useReviewLifecycle stream retry", () => {
  it("resumes the active review through the shared stream lifecycle", () => {
    const base = makeBaseReturn();
    mockUseReviewLifecycleBase.mockReturnValue(base);
    const { result } = renderReviewLifecycle("unstaged");

    result.current.handleRetry("active-review");

    expect(base.stream.resume).toHaveBeenCalledWith("active-review");
  });
});

describe("useReviewLifecycle completion cache cleanup", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
  });

  it("clears the active session before emitting completion", () => {
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

    act(() => {
      emitComplete?.();
    });

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

  it("emits completion from the View Results event path", () => {
    const onComplete = vi.fn();
    const base = makeRunningBaseReturn();
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      base.completion.skipDelay = vi.fn(() => options.onComplete());
      return base;
    });

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged", onComplete }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.handleViewResults();
    });

    expect(base.completion.skipDelay).toHaveBeenCalled();
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
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings/providers" });
    });
    expect(base.stream.cancel).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      preserveState: true,
    });
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
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

  it("clears the active session, shows timeout toast copy, and navigates home on SESSION_TIMEOUT", () => {
    let onStale: ((code: string) => void) | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      onStale = options.onStaleSession;
      return makeRunningBaseReturn();
    });

    const copy = sessionTerminationCopy(ReviewErrorCode.SESSION_TIMEOUT);

    renderReviewLifecycle("unstaged");

    act(() => {
      onStale?.(ReviewErrorCode.SESSION_TIMEOUT);
    });

    expect(mockClearActiveSession).toHaveBeenCalledOnce();
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockToastError).toHaveBeenCalledWith(copy.title, { message: copy.message });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });
});

function createMockApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    createReview: mockCreateReview,
    activateProvider: vi
      .fn()
      .mockResolvedValue({ provider: "openrouter", model: "openrouter/test-model" }),
    deleteProviderCredentials: vi.fn().mockResolvedValue({ deleted: true }),
    getProviderStatus: vi
      .fn()
      .mockResolvedValue([{ provider: "openrouter", hasApiKey: true, isActive: true }]),
    loadInit: vi.fn().mockResolvedValue({
      config: { provider: "openrouter", model: "openrouter/test-model" },
      configured: true,
      project: { projectId: "proj-1", path: "/repo", trust: null },
      providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
      settings: {
        agentExecution: "parallel",
        defaultLenses: [],
        defaultProfile: null,
        secretsStorage: null,
        severityThreshold: "low",
        theme: "terminal",
      },
      setup: {
        hasModel: true,
        hasProvider: true,
        hasSecretsStorage: true,
        hasTrust: false,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
}
