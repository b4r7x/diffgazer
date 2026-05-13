import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider } from "@/components/layout";
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
  mockToastError,
  mockUseReview,
  mockUseReviewLifecycleBase,
  routeState,
} = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastError: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
  routeState: {
    params: {} as { reviewId?: string },
    search: {} as { mode?: ReviewMode },
  },
}));

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

vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    error: mockToastError,
  },
}));

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
            <FooterProvider>{children}</FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </QueryClientProvider>
    );
  }

  return render(<ReviewPage />, { wrapper: Wrapper });
}

describe("ReviewPage saved review loading", () => {
  beforeEach(() => {
    routeState.params = {};
    routeState.search = {};
    mockBack.mockReset();
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
    mockToastError.mockReset();
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
  });

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

  it("keeps a routed live review streaming instead of loading it from history", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.search = { mode: "unstaged" };
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

    const { rerender } = renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId },
        search: expect.any(Function),
        replace: true,
      });
    });

    routeState.params = { reviewId };
    mockUseReview.mockClear();
    rerender(<ReviewPage />);

    expect(screen.getByText("Progress Overview")).toBeInTheDocument();
    expect(mockUseReview).toHaveBeenCalledWith("");
    expect(mockUseReview).not.toHaveBeenCalledWith(reviewId);
  });

  it("starts a fresh streaming review when the saved review is not found", async () => {
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
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: {},
        search: { mode: "staged" },
        replace: true,
      });
    });
    expect(screen.getByText("Progress Overview")).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("starts a fresh streaming review when the saved review has no result", async () => {
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
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: {},
        search: { mode: "unstaged" },
        replace: true,
      });
    });
    expect(screen.getByText("Progress Overview")).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
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

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error Loading Review", {
        message: "HTTP 500",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}" }),
    );
  });
});
