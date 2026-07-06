import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

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
    useCreateReview: () => ({ mutateAsync: mockCreateReview }),
    useReviewLifecycleBase: mockUseReviewLifecycleBase,
    useReviewSessionCache: () => ({
      clearActiveSession: mockClearActiveSession,
    }),
  };
});

import { useReviewLifecycle } from "./use-lifecycle";

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
      cancel: vi.fn(async () => null),
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
    completion: { isCompleting: false, skipDelay: vi.fn(), resetCompletion: vi.fn() },
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

  it("clears only the active-session cache on Back from a remote-cancel terminal state", () => {
    const base = makeRunningBaseReturn();
    base.stream.state.isStreaming = false;
    base.stream.state.error = "Review was cancelled remotely.";
    base.stream.state.errorCode = ReviewErrorCode.CANCELLED;
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
      return makeRunningBaseReturn();
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
    expect(base.stream.cancel).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "staged",
      "11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("useReviewLifecycle terminal session messages", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeBaseReturn());
  });

  it("surfaces a distinct cause-accurate message per terminal session code", () => {
    const captured: Array<(code: string) => void> = [];
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      captured.push(options.onStaleSession);
      return makeRunningBaseReturn();
    });

    renderReviewLifecycle("unstaged");
    const onStale = captured.at(-1);

    onStale?.("SESSION_EVICTED");
    onStale?.("SESSION_TIMEOUT");
    onStale?.("SERVER_SHUTDOWN");

    expect(mockClearActiveSession).toHaveBeenCalledTimes(3);
    expect(mockClearActiveSession).toHaveBeenCalledWith(
      "unstaged",
      "11111111-1111-4111-8111-111111111111",
    );
    const messages = mockToastError.mock.calls.map((call) => call[1].message as string);
    expect(messages).toHaveLength(3);
    expect(new Set(messages).size).toBe(3);
    // The third toast (SERVER_SHUTDOWN) must not invite an immediate retry.
    const shutdownMessage = messages.at(-1) ?? "";
    expect(shutdownMessage).not.toMatch(/start|retry|again/i);
  });
});

function createMockApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
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
