import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
  useCanGoBack: () => false,
}));

import type { BoundApi } from "@diffgazer/core/api";
import { formatRunId } from "@diffgazer/core/format";
import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import type { ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FooterView } from "@/testing/footer-view";
import { expectSingleReticle } from "@/testing/reticle";
import {
  defaultReviewsResponse,
  makeReviewResponse,
  mockGetReview,
  mockGetReviews,
  mockLoadInit,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
} from "../testing/page";
import { HistoryPage } from "./page";

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
    const reviews = createDeferred<Awaited<ReturnType<BoundApi["getReviews"]>>>();
    mockGetReviews.mockReturnValue(reviews.promise);

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByText("Loading runs...")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /review runs/i })).not.toBeInTheDocument();

    reviews.resolve(defaultReviewsResponse());

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("keeps the warning live region mounted from loading through deferred warnings", async () => {
    const reviews = createDeferred<Awaited<ReturnType<BoundApi["getReviews"]>>>();
    mockGetReviews.mockReturnValue(reviews.promise);

    const { container } = renderHistoryPage(<HistoryPage />);
    await screen.findByText("Loading runs...");
    const liveRegion = container.querySelector('[aria-live="polite"]');

    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveTextContent("");

    reviews.resolve({
      ...defaultReviewsResponse(),
      warnings: [
        {
          kind: "unreadable_review",
          reviewId: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });

    expect(await screen.findByText(/#33333333.*could not be read/i)).toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toBe(liveRegion);
  });

  it("brackets exactly one pane on the loaded screen", async () => {
    const { container } = renderHistoryPage(<HistoryPage />);

    // Brackets follow real focus now, so the assertion waits for the runs list
    // to actually receive it rather than for the pane to merely render.
    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    expectSingleReticle(container);
  });

  it("announces the error branch and offers a way out of it", async () => {
    const user = userEvent.setup();
    mockGetReviews.mockRejectedValue(new Error("disk unreadable"));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Reviews Unavailable");
    expect(screen.getByText(/disk unreadable/)).toBeVisible();

    mockGetReviews.mockResolvedValue(defaultReviewsResponse());
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("listbox", { name: /review runs/i })).toBeInTheDocument();
  });

  it("lets the error screen own the footer instead of advertising history shortcuts", async () => {
    mockGetReviews.mockRejectedValue(new Error("disk unreadable"));

    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await screen.findByRole("alert");
    const footer = within(screen.getByRole("contentinfo"));

    await waitFor(() => expect(footer.getByText("Move Action")).toBeInTheDocument());
    expect(footer.getByText("Retry")).toBeInTheDocument();
    expect(footer.queryByText("Switch Pane")).not.toBeInTheDocument();
    expect(footer.queryByText("Open Review")).not.toBeInTheDocument();
    expect(footer.queryByText("Search")).not.toBeInTheDocument();
  });

  it("shows an init error instead of routing through untrusted defaults", async () => {
    mockLoadInit.mockRejectedValue(new Error("init unavailable"));

    renderHistoryPage(<HistoryPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
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

    expect(
      await screen.findByText("2 saved reviews (#22222222, #33333333) could not be read."),
    ).toBeInTheDocument();
  });

  it("bounds high-cardinality warning copy in a named keyboard-scroll region", async () => {
    const warningIds = Array.from(
      { length: 50 },
      (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "readable-review" })],
      warnings: warningIds.map((reviewId) => ({ kind: "unreadable_review" as const, reviewId })),
    });

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const warningRegion = await screen.findByRole("region", { name: "History warnings" });
    expect(warningRegion).toHaveAttribute("tabindex", "0");
    expect(warningRegion).toHaveAttribute("aria-describedby", "history-warning-scroll-hint");
    expect(screen.getByText(/Focus this region to scroll warnings/i)).toBeInTheDocument();
    expect(screen.getByText(/… \+47 more/)).toBeInTheDocument();
    expect(warningRegion).toHaveTextContent("#00000003");
    expect(warningRegion).toHaveTextContent("00000031-1111-4111-8111-111111111111");

    Object.defineProperties(warningRegion, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    warningRegion.focus();
    await user.keyboard("{ArrowDown}");

    expect(warningRegion).toHaveFocus();
    expect(warningRegion.scrollTop).toBe(40);
    expect(screen.getByRole("listbox", { name: /review runs/i })).toBeInTheDocument();
  });

  it("keeps warning copy out of output and exposes the full target list", async () => {
    const warningId = "33333333-3333-4333-8333-333333333333";
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      warnings: [{ kind: "unreadable_review", reviewId: warningId }],
    });

    const { container } = renderHistoryPage(<HistoryPage />);

    const warningRegion = await screen.findByRole("region", { name: "History warnings" });
    expect(container.querySelector('output > p, output > [data-slot="scroll-area"]')).toBeNull();
    expect(warningRegion).toHaveTextContent(`#${warningId.slice(0, 8)}`);
    expect(warningRegion).toHaveTextContent(warningId);
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

  it("shares warning-only id collisions across labels, search, and salvage annotations", async () => {
    const unreadableId = "abcdef00-0000-4000-8000-000000000000";
    const affectedId = "abcdef00-1000-4000-8000-000000000000";
    const unaffectedId = "fedcba99-2000-4000-8000-000000000000";
    const user = userEvent.setup();
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: affectedId }), makeReviewMetadata({ id: unaffectedId })],
      warnings: [
        { kind: "unreadable_review", reviewId: unreadableId },
        { kind: "invalid_issues_dropped", reviewId: affectedId, count: 1 },
      ],
    });

    renderHistoryPage(<HistoryPage />);

    expect(
      await screen.findByText("1 saved review (#abcdef00-0) could not be read."),
    ).toBeInTheDocument();
    expect(await screen.findByText(/omitted from #abcdef00-1/i)).toBeInTheDocument();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    const options = within(runsList).getAllByRole("option");
    const affectedRun = options.find((option) => option.textContent?.includes("#abcdef00-1"));
    const unaffectedRun = options.find((option) => option.textContent?.includes("#fedcba99"));

    if (!affectedRun || !unaffectedRun) throw new Error("Expected both history runs");
    expect(affectedRun).toHaveTextContent("Salvaged");
    expect(unaffectedRun).not.toHaveTextContent("Salvaged");

    const searchInput = screen.getByRole("searchbox", { name: /search/i });
    await user.type(searchInput, "#abcdef00-1");
    await waitFor(() => expect(within(runsList).getAllByRole("option")).toHaveLength(1));
    expect(within(runsList).getByRole("option")).toHaveTextContent("#abcdef00-1");
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

  it("keeps the loaded history visible when loading older runs fails", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews
      .mockResolvedValueOnce({
        reviews: defaultReviewsResponse().reviews,
        nextCursor,
      })
      .mockRejectedValueOnce(new Error("page two unreadable"));

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await screen.findByRole("listbox", { name: /review runs/i });
    await user.click(await screen.findByRole("button", { name: "Load older runs" }));

    expect(await screen.findByText(/Could not load older runs/i)).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: /review runs/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("loads older runs on demand and removes the control after the final page", async () => {
    const olderId = "33333333-3333-4333-8333-333333333333";
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (cursor) =>
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
    expect(mockGetReviews).toHaveBeenLastCalledWith(nextCursor, expect.any(AbortSignal));
  });
});

describe("HistoryPage run list presentation", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("closes the run list with an end marker counting the listed runs", async () => {
    renderHistoryPage(<HistoryPage />);

    const runsPanel = await screen.findByRole("region", { name: "Review runs" });
    expect(within(runsPanel).getByText("── 2 runs ──")).toBeVisible();
  });

  it("omits the end marker when no runs are listed", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    renderHistoryPage(<HistoryPage />);

    const runsPanel = await screen.findByRole("region", { name: "Review runs" });
    await waitFor(() => expect(within(runsPanel).getByRole("status")).toHaveTextContent("No runs"));
    expect(within(runsPanel).queryByText(/──/)).not.toBeInTheDocument();
  });

  it("renders the run scope through the badge primitive, uppercased by CSS alone", async () => {
    renderHistoryPage(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    // The branch name stays lowercase in the DOM, so screen readers and copy/paste
    // get the real ref while the badge recipe paints the uppercase tier (pinned in
    // the ui library's own badge test).
    const scopeChips = within(runsList).getAllByText("main");
    expect(scopeChips).toHaveLength(2);
    for (const chip of scopeChips) {
      expect(chip).toHaveAttribute("data-slot", "badge");
    }
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
