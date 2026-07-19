import { FooterProvider } from "@diffgazer/core/footer";
import { createInitialReviewState, formatRunId, reviewReducer } from "@diffgazer/core/review";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster, toast } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

type ReviewQueryState = {
  data?: unknown;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
};

const {
  mockBack,
  mockClearActiveSession,
  mockNavigate,
  mockUseReview,
  mockUseReviewLifecycleBase,
  routeState,
} = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockClearActiveSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
  routeState: {
    canGoBack: false,
    params: {} as { reviewId?: string },
    pathname: "/review/test-id",
    search: {} as { mode?: ReviewMode; live?: boolean; issueId?: string },
  },
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeState.params,
  useRouter: () => ({
    history: {
      back: mockBack,
    },
    navigate: mockNavigate,
  }),
  useSearch: () => routeState.search,
  useCanGoBack: () => routeState.canGoBack,
  useLocation: () => ({ pathname: routeState.pathname }),
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const { makeCreateReviewResponse } = await vi.importActual<
    typeof import("@diffgazer/core/testing/factories")
  >("@diffgazer/core/testing/factories");
  const initResponse = {
    configPath: "/tmp/diffgazer/config.json",
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    configured: true,
    project: { projectId: "project-1", path: "/repo", trust: null },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: false,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  } satisfies InitResponse;

  return {
    configQueries: {
      all: () => ["config"],
    },
    useActivateProvider: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
    useDeleteProviderCredentials: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
    useInit: () => ({ data: initResponse, error: null, isLoading: false }),
    useProviderStatus: () => ({
      data: [{ provider: "gemini", hasApiKey: true, isActive: true }],
      error: null,
      isLoading: false,
    }),
    useReview: mockUseReview,
    useReviewContext: () => ({ data: null }),
    useReviewLifecycleBase: mockUseReviewLifecycleBase,
    useReviewSessionCache: () => ({
      clearActiveSession: mockClearActiveSession,
    }),
    useCreateReview: () => ({
      mutateAsync: vi.fn(async ({ mode }: { mode: ReviewMode }) =>
        makeCreateReviewResponse({ reviewId: "rev-alternate", session: { mode } }),
      ),
    }),
    useSaveConfig: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  };
});

import { ReviewPage } from "./page";

function reviewQuery(state: Partial<ReviewQueryState>): ReviewQueryState {
  return {
    data: undefined,
    error: null,
    isError: false,
    isSuccess: false,
    ...state,
  };
}

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function makeStreamState() {
  return {
    steps: [],
    agents: [],
    issues: [],
    events: [],
    fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
    notices: [],
    isStreaming: true,
    error: null,
    startedAt: null,
    reviewId: null,
  };
}

function renderPage({ strict = false }: { strict?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <KeyboardProvider>
            <FooterProvider>
              {children}
              <Toaster />
            </FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </QueryClientProvider>
    );

    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  }

  return render(<ReviewPage />, { wrapper: Wrapper });
}

function resetReviewMocks() {
  toast.dismiss();
  routeState.params = {};
  routeState.canGoBack = false;
  routeState.pathname = "/review/test-id";
  routeState.search = {};
  mockBack.mockReset();
  mockClearActiveSession.mockReset();
  mockNavigate.mockReset();
  mockNavigate.mockResolvedValue(undefined);
  mockUseReview.mockReset();
  mockUseReview.mockReturnValue(reviewQuery({}));
  mockUseReviewLifecycleBase.mockReset();
  mockUseReviewLifecycleBase.mockReturnValue({
    stream: { stop: vi.fn(), abort: vi.fn(), cancel: vi.fn(), state: makeStreamState() },
    checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
    completion: {
      isCompleting: false,
      completedAt: null,
      skipDelay: vi.fn(),
      resetCompletion: vi.fn(),
    },
    start: { hasStarted: true, hasStreamed: true, setHasStarted: vi.fn(), setHasStreamed: vi.fn() },
  });
}

describe("ReviewPage saved review loading", () => {
  beforeEach(resetReviewMocks);

  it("shows a saved review loading message while the saved review is loading", () => {
    routeState.params = { reviewId: "review-loading" };

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading review...");
  });

  it("opens a saved review at its summary before letting the user view results", async () => {
    const user = userEvent.setup();
    const issue = makeIssue({
      id: "issue-1",
      title: "Saved result issue",
      symptom: "Saved result issue symptom",
    });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "review-saved", durationMs: 2500 },
            result: {
              issues: [issue],
            },
          },
        },
      }),
    );

    renderPage();

    expect(
      await screen.findByText(`Review Complete ${formatRunId("review-saved")}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Duration:").parentElement).toHaveTextContent("Duration: 2.5s");
    expect(screen.getByText("Saved result issue")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /saved result issue/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(await screen.findByText(`Review ${formatRunId("review-saved")}`)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /saved result issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Saved result issue symptom")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens a valid saved-review issue deep link directly in results", async () => {
    const firstIssue = makeIssue({
      id: "issue-1",
      title: "First saved issue",
      symptom: "First saved symptom",
    });
    const linkedIssue = makeIssue({
      id: "issue-2",
      title: "Linked saved issue",
      symptom: "Linked saved symptom",
    });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged", issueId: "issue-2" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [firstIssue, linkedIssue] },
            droppedDuplicates: 1,
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("option", { name: /linked saved issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Linked saved symptom")).toBeInTheDocument();
    expect(
      screen.queryByText(`Review Complete ${formatRunId("review-saved")}`),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (3 → 2 issues)",
    );
  });

  it("keeps an invalid saved-review issue deep link on the safe summary view", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged", issueId: "missing-issue" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
          },
        },
      }),
    );

    renderPage();

    expect(
      await screen.findByText(`Review Complete ${formatRunId("review-saved")}`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /saved result issue/i })).not.toBeInTheDocument();
  });

  it("explains persisted duplicate collapse in a reopened review summary", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
            droppedDuplicates: 1,
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (2 → 1 issue)",
    );
  });

  it("keeps a routed live review streaming instead of loading it from history", () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.params = { reviewId };
    routeState.search = { mode: "unstaged", live: true };
    mockUseReviewLifecycleBase.mockReturnValue({
      stream: {
        stop: vi.fn(),
        abort: vi.fn(),
        cancel: vi.fn(),
        state: { ...makeStreamState(), reviewId },
      },
      checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
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
    });

    renderPage();

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
  });

  it("streams when the saved review returns 404", async () => {
    routeState.params = { reviewId: "missing-review" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isError: true,
        error: apiError(404),
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("streams when the saved review has no result", async () => {
    routeState.params = { reviewId: "unfinished-review" };
    routeState.search = { mode: "unstaged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "unfinished-review" },
            result: null,
          },
        },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports saved review errors without replacing the route", async () => {
    routeState.params = { reviewId: "broken-review" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isError: true,
        error: apiError(500),
      }),
    );

    renderPage();

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/error loading review/i);
    expect(errorToast).toHaveTextContent("HTTP 500");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}" }),
    );
  });

  it("reports a saved review error exactly once when the report effect re-runs", async () => {
    routeState.params = { reviewId: "broken-review" };
    routeState.search = { mode: "staged" };
    // A fresh error object every render makes the report effect's dependency change
    // identity, so without the fired-once ref guard handleApiError (toast + home
    // redirect) would re-fire on each re-render (F-304).
    mockUseReview.mockImplementation(() => reviewQuery({ isError: true, error: apiError(500) }));

    const { rerender } = renderPage({ strict: true });

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/error loading review/i);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });

    rerender(<ReviewPage />);
    rerender(<ReviewPage />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(mockNavigate.mock.calls.filter(([arg]) => arg?.to === "/")).toHaveLength(1);
  });
});

describe("ReviewPage no-reviewId redirect", () => {
  beforeEach(resetReviewMocks);

  it("renders the redirect fallback when reviewId is missing", () => {
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Redirecting...");
  });
});

describe("ReviewPage stale live session falls back to saved review", () => {
  const STALE_REVIEW_ID = "33333333-3333-4333-8333-333333333333";

  interface CapturedCallbacks {
    onNotFoundInSession: ((reviewId: string) => void) | null;
  }

  let captured: CapturedCallbacks;

  beforeEach(() => {
    resetReviewMocks();
    captured = { onNotFoundInSession: null };
    routeState.params = { reviewId: STALE_REVIEW_ID };
    routeState.search = { mode: "staged", live: true };
    mockUseReviewLifecycleBase.mockImplementation(
      (opts: { onNotFoundInSession?: (id: string) => void }) => {
        captured.onNotFoundInSession = opts.onNotFoundInSession ?? null;
        return {
          stream: {
            stop: vi.fn(),
            abort: vi.fn(),
            cancel: vi.fn(),
            state: { ...makeStreamState(), reviewId: STALE_REVIEW_ID },
          },
          checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
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
      },
    );
  });

  it("falls back to saved review when live stream returns 404 and saved review exists", async () => {
    const savedIssue = makeIssue({
      id: "saved-1",
      title: "Saved fallback issue",
      symptom: "Saved fallback symptom",
    });
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: STALE_REVIEW_ID },
            result: { issues: [savedIssue] },
          },
        },
      }),
    );

    renderPage();

    // Initially streaming
    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();

    // Simulate stream 404 -- onNotFoundInSession fires from use-review-start
    await act(() => {
      captured.onNotFoundInSession?.(STALE_REVIEW_ID);
    });

    expect(
      await screen.findByText(`Review Complete ${formatRunId(STALE_REVIEW_ID)}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Saved fallback issue")).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("staged", STALE_REVIEW_ID);
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
  });

  it("shows error toast and navigates home when both stream and saved review return 404", async () => {
    mockUseReview.mockReturnValue(
      reviewQuery({
        isError: true,
        error: apiError(404),
      }),
    );

    renderPage();

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();

    // Simulate stream 404
    await act(() => {
      captured.onNotFoundInSession?.(STALE_REVIEW_ID);
    });

    // Should show exactly one error toast and navigate home -- not loop
    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/live session has expired/i);
    expect(mockClearActiveSession).toHaveBeenCalledWith("staged", STALE_REVIEW_ID);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });
});

describe("ReviewPage reviewId changes", () => {
  const FIRST_REVIEW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const SECOND_REVIEW_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    resetReviewMocks();
    routeState.search = { mode: "unstaged", live: true };
  });

  it("does not keep the previous live review results when reviewId changes", async () => {
    const firstIssue = makeIssue({
      id: "first-issue",
      title: "First review issue",
      symptom: "First review symptom",
    });

    let capturedOnComplete: (() => void) | null = null;
    routeState.params = { reviewId: FIRST_REVIEW_ID };

    mockUseReviewLifecycleBase.mockImplementation((opts: { onComplete?: () => void }) => {
      capturedOnComplete = opts.onComplete ?? null;
      return {
        stream: {
          stop: vi.fn(),
          abort: vi.fn(),
          cancel: vi.fn(),
          state: { ...makeStreamState(), reviewId: FIRST_REVIEW_ID, issues: [firstIssue] },
        },
        checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
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
    });

    const view = renderPage();

    await act(() => {
      capturedOnComplete?.();
    });
    expect(
      await screen.findByText(`Review Complete ${formatRunId(FIRST_REVIEW_ID)}`),
    ).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("unstaged", FIRST_REVIEW_ID);

    routeState.params = { reviewId: SECOND_REVIEW_ID };
    mockUseReviewLifecycleBase.mockReturnValue({
      stream: {
        stop: vi.fn(),
        abort: vi.fn(),
        cancel: vi.fn(),
        state: { ...makeStreamState(), reviewId: SECOND_REVIEW_ID },
      },
      checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
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
    });

    view.rerender(<ReviewPage />);

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(
      screen.queryByText(`Review Complete ${formatRunId(FIRST_REVIEW_ID)}`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("First review issue")).not.toBeInTheDocument();
  });
});

describe("ReviewPage live review phase transitions", () => {
  const LIVE_REVIEW_ID = "22222222-2222-4222-8222-222222222222";
  const liveIssueOne = makeIssue({
    id: "live-issue-1",
    title: "Live issue one",
    file: "src/a.ts",
    category: "correctness",
  });
  const liveIssueTwo = makeIssue({
    id: "live-issue-2",
    title: "Live issue two",
    file: "src/b.ts",
    category: "security",
  });
  const completedIssues = [liveIssueOne, liveIssueTwo];
  const streamedDuplicate = makeIssue({
    id: "live-issue-duplicate",
    title: "Live issue duplicate",
    file: "src/a.ts",
    category: "correctness",
  });

  let capturedOnComplete: (() => void) | null;
  let streamedIssueCount = 0;

  beforeEach(() => {
    resetReviewMocks();
    capturedOnComplete = null;
    routeState.params = { reviewId: LIVE_REVIEW_ID };
    routeState.search = { mode: "unstaged", live: true };
    const issueEvents = [
      {
        type: "issue_found" as const,
        agent: "detective" as const,
        issue: liveIssueOne,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "issue_found" as const,
        agent: "guardian" as const,
        issue: liveIssueTwo,
        timestamp: "2026-01-01T00:00:01.000Z",
      },
      {
        type: "issue_found" as const,
        agent: "tester" as const,
        issue: streamedDuplicate,
        timestamp: "2026-01-01T00:00:02.000Z",
      },
    ];
    const streamedState = issueEvents.reduce(
      (state, event) => reviewReducer(state, { type: "EVENT", event }),
      reviewReducer(createInitialReviewState(), { type: "START" }),
    );
    streamedIssueCount = streamedState.issues.length;
    const completedEventState = reviewReducer(streamedState, {
      type: "EVENT",
      event: {
        type: "orchestrator_complete",
        totalIssues: 2,
        lensStats: [
          { lensId: "correctness", issueCount: 2, status: "success" },
          { lensId: "security", issueCount: 1, status: "success" },
        ],
        filesAnalyzed: 2,
        droppedDuplicates: 1,
        timestamp: "2026-01-01T00:00:03.000Z",
      },
    });
    const completedState = reviewReducer(completedEventState, {
      type: "COMPLETE_WITH_RESULT",
      issues: completedIssues,
    });
    mockUseReviewLifecycleBase.mockImplementation((opts: { onComplete?: () => void }) => {
      capturedOnComplete = opts.onComplete ?? null;
      return {
        stream: {
          stop: vi.fn(),
          abort: vi.fn(),
          cancel: vi.fn(),
          state: {
            ...makeStreamState(),
            ...completedState,
            reviewId: LIVE_REVIEW_ID,
          },
        },
        checks: { loadingMessage: null, isNoDiffError: false, isCheckingForChanges: false },
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
    });
  });

  it("transitions from streaming to summary when onComplete fires", async () => {
    renderPage();

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(
      await screen.findByText(`Review Complete ${formatRunId(LIVE_REVIEW_ID)}`),
    ).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("unstaged", LIVE_REVIEW_ID);
    expect(screen.getByRole("button", { name: /view results/i })).toBeInTheDocument();
  });

  it("carries the live duplicate-collapse count into the summary", async () => {
    renderPage();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(streamedIssueCount).toBe(3);
    expect(await screen.findByText("2 issues")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (3 → 2 issues)",
    );
  });

  it("transitions from summary to results when Enter Review is clicked", async () => {
    const user = userEvent.setup();

    renderPage();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(
      await screen.findByText(`Review Complete ${formatRunId(LIVE_REVIEW_ID)}`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(await screen.findByText(`Review ${formatRunId(LIVE_REVIEW_ID)}`)).toBeInTheDocument();
    expect(
      screen.queryByText(`Review Complete ${formatRunId(LIVE_REVIEW_ID)}`),
    ).not.toBeInTheDocument();
  });

  async function openSummary() {
    const user = userEvent.setup();
    renderPage();
    await act(() => {
      capturedOnComplete?.();
    });
    expect(
      await screen.findByText(`Review Complete ${formatRunId(LIVE_REVIEW_ID)}`),
    ).toBeInTheDocument();
    return user;
  }

  async function triggerBack(
    user: ReturnType<typeof userEvent.setup>,
    control: "button" | "escape",
  ) {
    if (control === "button") {
      await user.click(screen.getByRole("button", { name: /back/i }));
      return;
    }
    await user.keyboard("{Escape}");
  }

  it.each(["button", "escape"] satisfies Array<
    "button" | "escape"
  >)("uses the safe home fallback for direct navigation via %s", async (control) => {
    const user = await openSummary();

    await triggerBack(user, control);

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it.each(["button", "escape"] satisfies Array<
    "button" | "escape"
  >)("uses browser history when available via %s", async (control) => {
    routeState.canGoBack = true;
    const user = await openSummary();

    await triggerBack(user, control);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
