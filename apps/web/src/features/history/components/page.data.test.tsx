import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

import { formatRunId, HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import type { ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPage } from "./page";
import {
  defaultReviewsResponse,
  makeReviewResponse,
  mockGetReview,
  mockGetReviews,
  mockLoadInit,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
} from "./page.test-utils";

describe("HistoryPage loading and error status", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("announces the loading branch as a status region", async () => {
    mockGetReviews.mockReturnValue(new Promise(() => {}));

    renderHistoryPage(<HistoryPage />);

    const loadingRuns = await screen.findByText("Loading runs...");
    expect(loadingRuns).toHaveAttribute("role", "status");
  });

  it("focuses the runs list after deferred reviews replace the loading state", async () => {
    const reviews = createDeferred<ReturnType<typeof defaultReviewsResponse>>();
    mockGetReviews.mockReturnValue(reviews.promise);

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText("Loading runs...")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /review runs/i })).not.toBeInTheDocument();

    reviews.resolve(defaultReviewsResponse());

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("announces the error branch as an alert region", async () => {
    mockGetReviews.mockRejectedValue(new Error("disk unreadable"));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Error: disk unreadable");
  });

  it("shows an init error instead of routing through untrusted defaults", async () => {
    mockLoadInit.mockRejectedValue(new Error("init unavailable"));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration unavailable.");
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });
});

describe("HistoryPage review detail status", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("keeps run metadata visible while the selected review detail is pending", async () => {
    const detail = createDeferred<ReviewResponse>();
    mockGetReview.mockReturnValue(detail.promise);

    renderHistoryPage(<HistoryPage />);

    const loadingDetails = await screen.findByText("Loading review details...");
    expect(
      within(screen.getByRole("complementary", { name: "Review insights" })).getByRole("status"),
    ).toBe(loadingDetails);
    expect(screen.getByText("Severity Breakdown")).toBeInTheDocument();

    detail.resolve(
      makeReviewResponse("11111111-1111-4111-8111-111111111111", [
        makeIssue({ id: "loaded-issue", title: "Loaded issue" }),
      ]),
    );

    expect(await screen.findByRole("option", { name: /loaded issue/i })).toBeInTheDocument();
    expect(screen.queryByText("Loading review details...")).not.toBeInTheDocument();
  });

  it("renders a retryable selected-review error and recovers on retry", async () => {
    mockGetReview
      .mockRejectedValueOnce(new Error("detail disk unreadable"))
      .mockImplementation(async (id) =>
        makeReviewResponse(id, [makeIssue({ id: "retried-issue", title: "Retried issue" })]),
      );

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("detail disk unreadable");
    expect(screen.getByText("Severity Breakdown")).toBeInTheDocument();

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{Tab}");
    const retry = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: /retried issue/i })).toBeInTheDocument();
    expect(screen.queryByText("detail disk unreadable")).not.toBeInTheDocument();
  });
});

describe("HistoryPage review-list warnings", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("renders a non-blocking notice with the dropped-review count when warnings are present", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" })],
      warnings: [
        {
          kind: "unreadable_review",
          reviewId: "22222222-2222-4222-8222-222222222222",
        },
        {
          kind: "unreadable_review",
          reviewId: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText(/2 saved reviews could not be read/i)).toBeInTheDocument();
  });

  it("renders index maintenance separately without inflating the unreadable count", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      warnings: [{ kind: "index_build_failed" }, { kind: "index_rewrite_failed" }],
    });

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText(/history index could not be rebuilt/i)).toBeInTheDocument();
    expect(screen.getByText(/history index could not be cleaned up/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved reviews? could not be read/i)).not.toBeInTheDocument();
  });

  it("reports salvaged issue loss independently from unreadable saved reviews", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      warnings: [
        {
          kind: "invalid_issues_dropped",
          reviewId: "11111111-1111-4111-8111-111111111111",
          count: 2,
        },
      ],
    });

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText(/2 invalid saved issues were omitted/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved reviews? could not be read/i)).not.toBeInTheDocument();
  });

  it("renders nothing when the warnings array is empty or absent", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());

    renderHistoryPage(<HistoryPage />);

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
  });
});

describe("HistoryPage review pagination", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("loads older runs on demand and removes the control after the final page", async () => {
    const olderId = "33333333-3333-4333-8333-333333333333";
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (_projectPath, cursor) =>
      cursor
        ? {
            reviews: [makeReviewMetadata({ id: olderId })],
            nextCursor: null,
          }
        : {
            reviews: defaultReviewsResponse().reviews,
            nextCursor,
          },
    );
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const loadMore = await screen.findByRole("button", { name: "Load older runs" });
    expect(screen.queryByText(formatRunId(olderId))).not.toBeInTheDocument();

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(document.activeElement).toBe(loadMore));
    await user.keyboard("{Enter}");

    expect(await screen.findByText(formatRunId(olderId))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older runs" })).not.toBeInTheDocument();
    expect(mockGetReviews).toHaveBeenLastCalledWith(undefined, nextCursor);
  });
});

describe("HistoryPage empty-runs live region", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("keeps the live status region mounted across the runs→empty transition", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());
    const { queryClient } = renderHistoryPage(<HistoryPage />);

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    const runsPanel = screen.getByRole("region", { name: "Review runs" });
    const liveRegion = within(runsPanel).getByRole("status");
    expect(liveRegion).toHaveTextContent("");

    mockGetReviews.mockResolvedValue({ reviews: [] });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["review"] });
    });

    expect(within(runsPanel).getByRole("status")).toBe(liveRegion);
    await waitFor(() => expect(liveRegion).toHaveTextContent("No runs yet"));
  });
});
