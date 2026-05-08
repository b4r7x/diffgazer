import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";

type ReviewQueryState = {
  data?: unknown;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
};

const {
  mockBack,
  mockHandleApiError,
  mockNavigate,
  mockUseReview,
  routeState,
} = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  routeState: {
    params: {} as { reviewId?: string },
    search: {} as { mode?: ReviewMode },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => routeState.params,
  useRouter: () => ({
    history: {
      back: mockBack,
    },
    navigate: mockNavigate,
  }),
  useSearch: () => routeState.search,
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useReview: mockUseReview,
}));

vi.mock("../hooks", async () => {
  const { isApiError } = await vi.importActual<typeof import("@diffgazer/core/api/types")>(
    "@diffgazer/core/api/types",
  );

  return {
    isApiError,
    useReviewErrorHandler: () => ({
      handleApiError: mockHandleApiError,
    }),
  };
});

vi.mock("./review-container", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    ReviewContainer: ({ mode }: { mode: ReviewMode }) =>
      React.createElement(
        "section",
        { "aria-label": "streaming review" },
        `Streaming ${mode}`,
      ),
    ReviewLoadingMessage: ({ message }: { message: string }) =>
      React.createElement("div", { role: "status" }, message),
  };
});

vi.mock("./review-results-view", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    ReviewResultsView: ({
      issues,
      reviewId,
    }: {
      issues: ReviewIssue[];
      reviewId: string | null;
    }) =>
      React.createElement(
        "section",
        { "aria-label": "review results" },
        React.createElement("h1", null, `Results for ${reviewId ?? "unknown"}`),
        React.createElement(
          "ul",
          null,
          issues.map((issue) => React.createElement("li", { key: issue.id }, issue.title)),
        ),
      ),
  };
});

vi.mock("./review-summary-view", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    ReviewSummaryView: ({ reviewId }: { reviewId: string | null }) =>
      React.createElement(
        "section",
        { "aria-label": "review summary" },
        `Summary for ${reviewId ?? "unknown"}`,
      ),
  };
});

import { ReviewPage } from "./page";

function makeIssue(id: string, title: string): ReviewIssue {
  return {
    id,
    severity: "high",
    category: "correctness",
    title,
    file: "src/example.ts",
    line_start: 10,
    line_end: 12,
    rationale: `${title} rationale`,
    recommendation: `${title} recommendation`,
    suggested_patch: null,
    confidence: 0.9,
    symptom: `${title} symptom`,
    whyItMatters: `${title} impact`,
    evidence: [
      {
        type: "code",
        title: `${title} evidence`,
        sourceId: `${id}-source`,
        excerpt: "const value = 1;",
      },
    ],
  };
}

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
  return { status, message: `HTTP ${status}` };
}

describe("ReviewPage saved review loading", () => {
  beforeEach(() => {
    routeState.params = {};
    routeState.search = {};
    mockBack.mockReset();
    mockHandleApiError.mockReset();
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
    mockUseReview.mockReset();
    mockUseReview.mockReturnValue(reviewQuery({}));
  });

  it("shows a saved review loading message while the saved review is loading", () => {
    routeState.params = { reviewId: "review-loading" };

    render(<ReviewPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading review...");
  });

  it("renders saved review results with fetched issues and review id", async () => {
    const issue = makeIssue("issue-1", "Saved result issue");
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

    render(<ReviewPage />);

    expect(
      await screen.findByRole("region", { name: "review results" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Results for review-saved" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Saved result issue")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
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

    render(<ReviewPage />);

    expect(await screen.findByRole("region", { name: "streaming review" })).toHaveTextContent(
      "Streaming staged",
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: {},
      search: { mode: "staged" },
      replace: true,
    });
    expect(mockHandleApiError).not.toHaveBeenCalled();
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

    render(<ReviewPage />);

    expect(await screen.findByRole("region", { name: "streaming review" })).toHaveTextContent(
      "Streaming unstaged",
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: {},
      search: { mode: "unstaged" },
      replace: true,
    });
    expect(mockHandleApiError).not.toHaveBeenCalled();
  });
});
