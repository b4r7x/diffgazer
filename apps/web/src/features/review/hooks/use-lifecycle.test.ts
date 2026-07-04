import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

const { mockNavigate, mockCreateReview, mockUseReviewLifecycleBase, mockToastError } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockCreateReview: vi.fn(),
    mockUseReviewLifecycleBase: vi.fn(),
    mockToastError: vi.fn(),
  }),
);

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
  };
});

import { useReviewLifecycle } from "./use-lifecycle";

let queryClient: QueryClient;
let mockApi: BoundApi;

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
        error: "No unstaged changes found",
        errorCode: ReviewErrorCode.NO_DIFF,
        startedAt: null,
        reviewId: "11111111-1111-4111-8111-111111111111",
      },
    },
    checks: { loadingMessage: null, isNoDiffError: true, isCheckingForChanges: false },
    completion: { isCompleting: false, skipDelay: vi.fn(), resetCompletion: vi.fn() },
    start: {
      hasStarted: true,
      hasStreamed: true,
      setHasStarted: vi.fn(),
      setHasStreamed: vi.fn(),
    },
  };
}

describe("useReviewLifecycle no-diff alternate start", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockToastError.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeBaseReturn());
    mockCreateReview.mockResolvedValue({ reviewId: "22222222-2222-4222-8222-222222222222" });
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
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
      search: { mode: alternateMode, live: true },
      replace: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
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
    expect(mockToastError).not.toHaveBeenCalled();
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
      return makeBaseReturn();
    });

    renderReviewLifecycle("unstaged");
    const onStale = captured.at(-1);

    onStale?.("SESSION_EVICTED");
    onStale?.("SESSION_TIMEOUT");
    onStale?.("SERVER_SHUTDOWN");

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
