import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { FooterProvider } from "@diffgazer/core/footer";
import { ConfigProvider } from "@/app/providers/config-provider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ReviewMode } from "@diffgazer/core/schemas/review";

type ReviewQueryState = {
  data?: unknown;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
};

const {
  mockBack,
  mockNavigate,
  mockUseReview,
  mockUseReviewLifecycleBase,
  routeState,
} = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
  routeState: {
    params: {} as { reviewId?: string },
    search: {} as { mode?: ReviewMode; live?: boolean },
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
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", () => ({
  configQueries: {
    all: () => ["config"],
  },
  useActivateProvider: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useDeleteProviderCredentials: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useInit: () => ({
    data: {
      config: { provider: "gemini", model: "gemini-2.5-flash" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
      project: { projectId: "project-1", path: "/repo", trust: null },
      setup: { isConfigured: true, isReady: true, missing: [] },
    },
    error: null,
    isLoading: false,
  }),
  useProviderStatus: () => ({
    data: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    error: null,
    isLoading: false,
  }),
  useReview: mockUseReview,
  useReviewContext: () => ({ data: null }),
  useReviewLifecycleBase: mockUseReviewLifecycleBase,
  useSaveConfig: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
}));

import { makeIssue } from "@/testing";
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
    isStreaming: true,
    error: null,
    startedAt: null,
    reviewId: null,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
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
  }

  return render(<ReviewPage />, { wrapper: Wrapper });
}

function resetReviewMocks() {
  routeState.params = {};
  routeState.search = {};
  mockBack.mockReset();
  mockNavigate.mockReset();
  mockNavigate.mockResolvedValue(undefined);
  mockUseReview.mockReset();
  mockUseReview.mockReturnValue(reviewQuery({}));
  mockUseReviewLifecycleBase.mockReset();
  mockUseReviewLifecycleBase.mockReturnValue({
    streamState: makeStreamState(),
    loadingMessage: null,
    isNoDiffError: false,
    stream: { stop: vi.fn() },
    skipDelay: vi.fn(),
    setHasStarted: vi.fn(),
  });
}

describe("ReviewPage saved review loading", () => {
  beforeEach(resetReviewMocks);

  it("shows a saved review loading message while the saved review is loading", () => {
    routeState.params = { reviewId: "review-loading" };

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading review...");
  });

  it("renders saved review results with fetched issues and review id", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue", symptom: "Saved result issue symptom" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        isSuccess: true,
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: {
              summary: "Saved review summary",
              issues: [issue],
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByText("Analysis #review-saved")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /saved result issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Saved result issue symptom")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a routed live review streaming instead of loading it from history", () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.params = { reviewId };
    routeState.search = { mode: "unstaged", live: true };
    mockUseReviewLifecycleBase.mockReturnValue({
      streamState: {
        ...makeStreamState(),
        reviewId,
      },
      loadingMessage: null,
      isNoDiffError: false,
      stream: { stop: vi.fn() },
      skipDelay: vi.fn(),
      setHasStarted: vi.fn(),
    });

    renderPage();

    expect(screen.getByText("Progress Overview")).toBeInTheDocument();
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
      expect(screen.getByText("Progress Overview")).toBeInTheDocument();
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
      expect(screen.getByText("Progress Overview")).toBeInTheDocument();
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
});

describe("ReviewPage no-reviewId redirect", () => {
  beforeEach(resetReviewMocks);

  it("renders the redirect fallback when reviewId is missing", () => {
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Redirecting...");
  });
});

describe("ReviewPage live review phase transitions", () => {
  const LIVE_REVIEW_ID = "22222222-2222-4222-8222-222222222222";
  const completedIssues = [
    makeIssue({ id: "live-issue-1", title: "Live issue one", file: "src/a.ts", category: "correctness" }),
    makeIssue({ id: "live-issue-2", title: "Live issue two", file: "src/b.ts", category: "security" }),
  ];

  let capturedOnComplete: (() => void) | null;

  beforeEach(() => {
    resetReviewMocks();
    capturedOnComplete = null;
    routeState.params = { reviewId: LIVE_REVIEW_ID };
    routeState.search = { mode: "unstaged", live: true };
    mockUseReviewLifecycleBase.mockImplementation((opts: { onComplete?: () => void }) => {
      capturedOnComplete = opts.onComplete ?? null;
      return {
        streamState: {
          ...makeStreamState(),
          reviewId: LIVE_REVIEW_ID,
          issues: completedIssues,
        },
        loadingMessage: null,
        isNoDiffError: false,
        stream: { stop: vi.fn() },
        skipDelay: vi.fn(),
        setHasStarted: vi.fn(),
      };
    });
  });

  it("transitions from streaming to summary when onComplete fires", async () => {
    renderPage();

    expect(screen.getByText("Progress Overview")).toBeInTheDocument();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(await screen.findByText(`Analysis Complete #${LIVE_REVIEW_ID}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter review/i })).toBeInTheDocument();
  });

  it("transitions from summary to results when Enter Review is clicked", async () => {
    const user = userEvent.setup();

    renderPage();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(await screen.findByText(`Analysis Complete #${LIVE_REVIEW_ID}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /enter review/i }));

    expect(await screen.findByText(`Analysis #${LIVE_REVIEW_ID}`)).toBeInTheDocument();
    expect(screen.queryByText(`Analysis Complete #${LIVE_REVIEW_ID}`)).not.toBeInTheDocument();
  });
});
