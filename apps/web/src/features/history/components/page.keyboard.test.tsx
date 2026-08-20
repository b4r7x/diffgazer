import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate, mockHistoryBack, mockRouterNavigate, routerState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockHistoryBack: vi.fn(),
  mockRouterNavigate: vi.fn(),
  routerState: { canGoBack: false },
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
  useRouter: () => ({ history: { back: mockHistoryBack }, navigate: mockRouterNavigate }),
  useCanGoBack: () => routerState.canGoBack,
}));

import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import type { ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { MAIN_CONTENT_ID } from "@/lib/main-content";
import { FooterView } from "@/testing/footer-view";
import { HeaderChromeHarness } from "@/testing/header-chrome";
import { expectSingleReticle } from "@/testing/reticle";
import {
  defaultReviewsResponse,
  focusRunsList,
  makeReviewResponse,
  mockGetReview,
  mockGetReviews,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
} from "../testing/page";
import { HistoryPage } from "./page";

describe("HistoryPage keyboard navigation", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    setupApiMocks(trustedProject());
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
    mockHistoryBack.mockReset();
    mockRouterNavigate.mockReset();
    routerState.canGoBack = false;
  });

  it("moves focus from timeline to runs at the boundary and opens the highlighted run", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();

    await user.click(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER));
    await user.keyboard("{ArrowDown}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{End}{ArrowDown}");
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{ArrowDown}{Enter}");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("opens the highlighted run on Space", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "22222222-2222-4222-8222-222222222222" },
      }),
    );
  });

  it("keeps Space opening the run the arrows chose after a printable key", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    await user.keyboard("{ArrowDown}");
    // The runs list opts out of typeahead, so z neither moves the highlight
    // nor starts a query that would swallow the advertised Space meaning.
    await user.keyboard("z");
    await user.keyboard(" ");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "22222222-2222-4222-8222-222222222222" },
      }),
    );
  });

  it("keeps exactly one pane bracketed as focus moves between panes", async () => {
    const user = userEvent.setup();
    const { container } = renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    expectSingleReticle(container);

    await user.click(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER));
    await user.keyboard("{ArrowDown}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    expectSingleReticle(container);
  });

  it("switches timeline keyboard behavior when clicking the selected section from runs", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Feb 9" })).toHaveAttribute("aria-selected", "true");
  });

  it("selects an unselected run on first pointer tap and navigates on the second", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();
    const runOptions = within(runsList).getAllByRole("option");
    const [initiallySelectedRun, unselectedRun] = runOptions;
    if (!initiallySelectedRun || !unselectedRun) {
      throw new Error("Expected at least two review run options");
    }
    await waitFor(() => expect(initiallySelectedRun).toHaveAttribute("aria-selected", "true"));
    expect(unselectedRun).not.toHaveAttribute("aria-selected", "true");

    mockNavigate.mockClear();
    await user.click(unselectedRun);

    expect(mockNavigate).not.toHaveBeenCalled();
    await waitFor(() => expect(unselectedRun).toHaveAttribute("aria-selected", "true"));

    mockNavigate.mockClear();
    await user.click(unselectedRun);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("opens the highlighted run with the open shortcut", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    await user.keyboard("{ArrowDown}o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("focuses search with slash without typing slash into the field", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    await user.keyboard("/");

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("clears the search filter on the first Escape and leaves the field on the second", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await user.keyboard("feature");
    await waitFor(() => expect(search).toHaveValue("feature"));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(search).toHaveValue(""));
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: /review runs/i })).toHaveFocus(),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
  });

  it("offers the Esc affordance only while a search is filtering everything out", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await user.keyboard("zzzznomatch");

    const empty = await screen.findByText("No runs match this search");
    const hint = screen.getByText(/clear search/);
    expect(empty).toBeInTheDocument();
    expect(within(hint).getByText("Esc").tagName).toBe("KBD");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(search).toHaveValue(""));
    expect(screen.queryByText(/clear search/)).not.toBeInTheDocument();
  });

  it("marks the active run with data-highlighted so theming can invert chip colors", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [
        makeReviewMetadata({
          id: "33333333-3333-4333-8333-333333333333",
          lowCount: 3,
          nitCount: 2,
          issueCount: 5,
        }),
      ],
    });

    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();

    const options = within(runsList).getAllByRole("option");
    const [activeRun] = options;
    if (activeRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(activeRun).toHaveAttribute("data-highlighted"));

    expect(within(activeRun).getByText(/3 low/i)).toBeInTheDocument();
    expect(within(activeRun).getByText(/2 nit/i)).toBeInTheDocument();
  });

  it("keeps the selected run marked as selected when focus moves to the insights pane", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();
    const [selectedRun] = within(runsList).getAllByRole("option");
    if (selectedRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(selectedRun).toHaveAttribute("data-highlighted"));

    await user.keyboard("{Tab}");

    await waitFor(() => expect(selectedRun).not.toHaveAttribute("data-highlighted"));
    expect(selectedRun).toHaveAttribute("aria-selected", "true");
    expect(selectedRun).toHaveAttribute("data-selected");
  });

  it("tags each pane frame with its corner label", async () => {
    renderHistoryPage(<HistoryPage />);

    await screen.findByRole("listbox", { name: /review runs/i });

    expect(
      within(screen.getByRole("complementary", { name: "Review sections" })).getByText("Sections"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Review runs" })).getByText("Runs"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Review insights" })).getByText(/^Insights/),
    ).toBeInTheDocument();
  });

  it("keeps native Tab on the skip link outside main while cycling history panes inside main", async () => {
    renderHistoryPage(
      <>
        <a href={`#${MAIN_CONTENT_ID}`}>Skip to content</a>
        <main id={MAIN_CONTENT_ID}>
          <HistoryPage />
        </main>
      </>,
    );

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    sectionsList.focus();
    await waitFor(() => expect(sectionsList).toHaveFocus());

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    skipLink.focus();
    expect(skipLink).toHaveFocus();

    // fireEvent retained: low-level Tab dispatch asserts the main boundary declines Tab on the skip link.
    const prevented = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);

    sectionsList.focus();
    // fireEvent retained: low-level Tab dispatch asserts the document-scope cycle claims Tab inside main.
    const preventedInside = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(preventedInside).toBe(true);

    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("keeps native Tab inside the search input", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await waitFor(() => expect(search).toHaveFocus());

    // fireEvent retained: low-level Tab dispatch asserts editable targets keep native Tab (no preventDefault).
    const prevented = !fireEvent.keyDown(search, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);
  });

  it("advertises the canonical Switch Pane label in the footer", async () => {
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await focusRunsList();

    expect(await screen.findByText("Switch Pane")).toBeInTheDocument();
    expect(screen.queryByText("Switch Focus")).not.toBeInTheDocument();
  });

  it("adds high-cardinality warning details to the managed focus cycle", async () => {
    const warningIds = Array.from(
      { length: 50 },
      (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "readable-review" })],
      warnings: warningIds.map((reviewId) => ({ kind: "unreadable_review" as const, reviewId })),
    });

    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    const runsList = await focusRunsList();
    const warningRegion = await screen.findByRole("region", { name: "History warnings" });

    await user.keyboard("{Tab}");

    await waitFor(() => expect(warningRegion).toHaveFocus());
    expect(
      within(screen.getByRole("contentinfo")).getByText("Scroll Warnings"),
    ).toBeInTheDocument();
    expect(warningRegion).toHaveTextContent("00000031-1111-4111-8111-111111111111");
    expect(runsList).not.toHaveFocus();
  });

  it("keeps retained history keyboardable after a background refetch error", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    mockGetReviews.mockRejectedValueOnce(new Error("background refresh failed"));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["review", "list"], exact: true });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("background refresh failed");
    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{Tab}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());

    await user.keyboard("{Tab}");

    await waitFor(() => expect(search).toHaveFocus());
  });

  it("moves focus back to runs when activating the list Retry clears the error", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await focusRunsList();
    mockGetReviews.mockRejectedValueOnce(new Error("background refresh failed"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["review", "list"], exact: true });
    });
    await screen.findByRole("alert");

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Retry History")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    await waitFor(() => expect(runsList).toHaveFocus());
    expect(footer.queryByText("Retry History")).not.toBeInTheDocument();
  });

  it("retries the failed list refresh with R without leaving the runs list", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await focusRunsList();
    mockGetReviews.mockRejectedValueOnce(new Error("background refresh failed"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["review", "list"], exact: true });
    });
    await screen.findByRole("alert");

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());
    expect(within(screen.getByRole("contentinfo")).getByText("Retry History")).toBeInTheDocument();

    await user.keyboard("{Shift>}R{/Shift}");

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(runsList).toHaveFocus();
  });

  it("retries the failed list refresh with R from the insights list", async () => {
    mockGetReview.mockImplementation(async (id) =>
      makeReviewResponse(id, [
        makeIssue({ id: "issue-a", severity: "high", title: "Alpha", file: "a.ts", line_start: 1 }),
      ]),
    );

    const user = userEvent.setup();
    const { queryClient } = renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });
    mockGetReviews.mockRejectedValueOnce(new Error("background refresh failed"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["review", "list"], exact: true });
    });
    await screen.findByRole("alert");

    insightsList.focus();
    await waitFor(() => expect(insightsList).toHaveFocus());

    await user.keyboard("{Shift>}R{/Shift}");

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(insightsList).toHaveFocus();
  });

  it("does not include runs or insights in the Tab cycle when there are no runs", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    search.focus();
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Tab}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("skips insights when the selected run has no issues", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    await screen.findByText("Severity Breakdown");
    expect(screen.queryByRole("listbox", { name: /run issues/i })).not.toBeInTheDocument();

    await user.keyboard("{Tab}");

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await waitFor(() => expect(document.activeElement).toBe(search));
  });

  it("adds insights to the focus cycle after deferred details mount its list", async () => {
    const detail = createDeferred<ReviewResponse>();
    mockGetReview.mockReturnValue(detail.promise);
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();
    await screen.findByText("Loading review details...");
    await user.keyboard("{Tab}");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)),
    );

    detail.resolve(
      makeReviewResponse("11111111-1111-4111-8111-111111111111", [
        makeIssue({ id: "deferred-issue", title: "Deferred issue" }),
      ]),
    );
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    runsList.focus();
    await waitFor(() => expect(document.activeElement).toBe(runsList));
    await user.keyboard("{Tab}");

    await waitFor(() => expect(document.activeElement).toBe(insightsList));
  });

  it("moves focus and the footer to runs when the final page removes the load-more control", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (cursor) =>
      cursor
        ? {
            reviews: [makeReviewMetadata({ id: "33333333-3333-4333-8333-333333333333" })],
            nextCursor: null,
          }
        : {
            reviews: defaultReviewsResponse().reviews,
            nextCursor,
          },
    );

    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    const loadMore = await screen.findByRole("button", { name: "Load older runs" });
    const runsList = await focusRunsList();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(loadMore).toHaveFocus());
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Load Older Runs")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load older runs" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(runsList).toHaveFocus());
    expect(footer.queryByText("Load Older Runs")).not.toBeInTheDocument();
    expect(footer.getByText("Open Review")).toBeInTheDocument();
  });

  it("loads older runs with l from the runs list but not while typing in search", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (cursor) =>
      cursor
        ? {
            reviews: [makeReviewMetadata({ id: "33333333-3333-4333-8333-333333333333" })],
            nextCursor: null,
          }
        : {
            reviews: defaultReviewsResponse().reviews,
            nextCursor,
          },
    );

    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await screen.findByRole("button", { name: "Load older runs" });
    await focusRunsList();
    expect(
      within(screen.getByRole("contentinfo")).getByText("Load Older Runs"),
    ).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER));
    await user.keyboard("l");
    expect(mockGetReviews).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    await focusRunsList();
    await user.keyboard("l");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load older runs" })).not.toBeInTheDocument(),
    );
  });

  it("loads older runs with l from the timeline list", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (cursor) =>
      cursor
        ? {
            reviews: [makeReviewMetadata({ id: "33333333-3333-4333-8333-333333333333" })],
            nextCursor: null,
          }
        : {
            reviews: defaultReviewsResponse().reviews,
            nextCursor,
          },
    );

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await screen.findByRole("button", { name: "Load older runs" });
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    sectionsList.focus();
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("l");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load older runs" })).not.toBeInTheDocument(),
    );
  });

  it("opens the highlighted run with the o the runs footer advertises", async () => {
    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await focusRunsList();
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Open Review")).toBeInTheDocument();
    expect(footer.getByText("Enter/Space/o")).toBeInTheDocument();

    await user.keyboard("o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("advertises l and R in every zone that is not typing in the search box", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      nextCursor,
    });

    const user = userEvent.setup();
    const { queryClient } = renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await screen.findByRole("button", { name: "Load older runs" });
    mockGetReviews.mockRejectedValueOnce(new Error("background refresh failed"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["review", "list"], exact: true });
    });
    await screen.findByRole("alert");

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    sectionsList.focus();
    await waitFor(() => expect(sectionsList).toHaveFocus());

    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Load Older Runs")).toBeInTheDocument();
    expect(footer.getByText("Retry History")).toBeInTheDocument();

    // Both keys type into the search box instead, so its footer leaves them out.
    await user.click(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER));

    await waitFor(() => expect(footer.queryByText("Load Older Runs")).not.toBeInTheDocument());
    expect(footer.queryByText("Retry History")).not.toBeInTheDocument();
  });

  it("moves focus from the runs bottom boundary to the load-more button", async () => {
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      nextCursor,
    });

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const loadMore = await screen.findByRole("button", { name: "Load older runs" });
    await focusRunsList();

    await user.keyboard("{End}{ArrowDown}");

    await waitFor(() => expect(loadMore).toHaveFocus());
  });

  it("hands off k from the insights top boundary to the runs list", async () => {
    mockGetReview.mockImplementation(async (id) =>
      makeReviewResponse(id, [
        makeIssue({ id: "issue-a", severity: "high", title: "Alpha", file: "a.ts", line_start: 1 }),
        makeIssue({ id: "issue-b", severity: "high", title: "Beta", file: "b.ts", line_start: 2 }),
      ]),
    );

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });
    insightsList.focus();
    await waitFor(() => expect(insightsList).toHaveFocus());

    await user.keyboard("k");

    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("pops the navigation stack on Escape when the shell can go back", async () => {
    routerState.canGoBack = true;
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(mockHistoryBack).toHaveBeenCalledTimes(1));
    expect(mockRouterNavigate).not.toHaveBeenCalled();
  });

  it("falls back to home on Escape when there is no history to pop", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(mockRouterNavigate).toHaveBeenCalledWith({ to: "/" }));
    expect(mockHistoryBack).not.toHaveBeenCalled();
  });

  it("moves focus to the runs list when activating retry unmounts the error alert", async () => {
    const detail = createDeferred<ReviewResponse>();
    mockGetReview
      .mockRejectedValueOnce(new Error("detail disk unreadable"))
      .mockReturnValue(detail.promise);

    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await screen.findByRole("alert");
    const runsList = await focusRunsList();

    await user.keyboard("{Tab}");
    const retryButton = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => expect(retryButton).toHaveFocus());

    await user.keyboard("{Enter}");

    await screen.findByText("Loading review details...");
    await waitFor(() => expect(runsList).toHaveFocus());
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.queryByText("Retry")).not.toBeInTheDocument();
    expect(footer.getByText("Open Review")).toBeInTheDocument();

    detail.resolve(
      makeReviewResponse("11111111-1111-4111-8111-111111111111", [
        makeIssue({ id: "retried-issue", title: "Retried issue" }),
      ]),
    );
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(insightsList).toHaveFocus());
  });

  it("moves the insights highlight with j alias and routes Enter to the issue handler", async () => {
    mockGetReview.mockImplementation(async (id) =>
      makeReviewResponse(id, [
        makeIssue({ id: "issue-a", severity: "high", title: "Alpha", file: "a.ts", line_start: 1 }),
        makeIssue({ id: "issue-b", severity: "high", title: "Beta", file: "b.ts", line_start: 2 }),
      ]),
    );

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    await focusRunsList();

    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    insightsList.focus();
    await waitFor(() => expect(insightsList).toHaveFocus());

    const alpha = screen.getByRole("option", { name: /alpha/i });
    const beta = screen.getByRole("option", { name: /beta/i });

    expect(insightsList).toHaveAttribute("aria-activedescendant", alpha.id);

    await user.keyboard("j");
    await waitFor(() => expect(insightsList).toHaveAttribute("aria-activedescendant", beta.id));

    mockNavigate.mockClear();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenLastCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "11111111-1111-4111-8111-111111111111" },
      search: { issueId: "issue-b" },
    });
  });

  it("re-anchors the insights highlight to the first issue when the selected run changes", async () => {
    mockGetReview.mockImplementation(async (id) => {
      if (id === "11111111-1111-4111-8111-111111111111") {
        return makeReviewResponse(id, [
          makeIssue({ id: "issue-a", severity: "high", title: "Alpha", line_start: 1 }),
          makeIssue({ id: "issue-b", severity: "high", title: "Beta", line_start: 2 }),
        ]);
      }
      return makeReviewResponse(id, [
        makeIssue({ id: "issue-x", severity: "blocker", title: "Brand new", line_start: 5 }),
      ]);
    });

    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsList = await focusRunsList();
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    insightsList.focus();
    await waitFor(() => expect(insightsList).toHaveFocus());

    const beta = screen.getByRole("option", { name: /beta/i });
    await user.keyboard("j");
    await waitFor(() => expect(insightsList).toHaveAttribute("aria-activedescendant", beta.id));

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(runsList).toHaveFocus());
    await user.keyboard("{ArrowDown}");

    const brandNew = await screen.findByRole("option", { name: /brand new/i });
    const updatedInsightsList = screen.getByRole("listbox", { name: /run issues/i });
    await waitFor(() =>
      expect(updatedInsightsList).toHaveAttribute("aria-activedescendant", brandNew.id),
    );
  });

  it("falls back to the search input on an empty history and leaves every pane unbracketed", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    renderHistoryPage(<HistoryPage />);

    await screen.findByText("No runs yet");

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await waitFor(() => expect(search).toHaveFocus());
    expect(screen.getByRole("region", { name: "Review runs" })).not.toHaveAttribute("data-state");
    expect(screen.getByRole("complementary", { name: "Review sections" })).not.toHaveAttribute(
      "data-state",
    );
    expect(screen.getByRole("complementary", { name: "Review insights" })).not.toHaveAttribute(
      "data-state",
    );
  });

  it("keeps focus in the search input when Escape has no runs list to return to", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    const user = userEvent.setup();
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(search).toHaveFocus());
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Clear Search")).toBeInTheDocument();
    expect(footer.queryByText("Open Review")).not.toBeInTheDocument();
  });

  it("does not programmatically focus the insights pane when no run is selected", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    renderHistoryPage(<HistoryPage />);

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);

    const insightsPane = screen.getByRole("complementary", { name: "Review insights" });
    expect(document.activeElement).not.toBe(insightsPane);
  });

  it("moves the active-pane affordance to the pane that owns keyboard focus", async () => {
    const user = userEvent.setup();
    renderHistoryPage(<HistoryPage />);

    const runsPane = await screen.findByRole("region", { name: "Review runs" });
    const sectionsPane = screen.getByRole("complementary", { name: "Review sections" });

    await focusRunsList();
    await waitFor(() => expect(runsPane).toHaveAttribute("data-state", "focused"));
    expect(sectionsPane).not.toHaveAttribute("data-state");

    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsPane).toHaveAttribute("data-state", "focused"));
    expect(runsPane).not.toHaveAttribute("data-state");
  });
});

describe("HistoryPage chrome hand-off", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    setupApiMocks(trustedProject());
    mockRouterNavigate.mockReset();
    mockHistoryBack.mockReset();
    routerState.canGoBack = false;
  });

  function renderWithChrome() {
    return renderHistoryPage(
      <HeaderChromeHarness>
        <main id={MAIN_CONTENT_ID}>
          <HistoryPage />
        </main>
        <FooterView />
      </HeaderChromeHarness>,
    );
  }

  it("parks the page zone on the chrome so the footer stops advertising the search box", async () => {
    const user = userEvent.setup();
    renderWithChrome();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    const footer = within(screen.getByRole("contentinfo"));
    await waitFor(() => expect(footer.getByText("Clear Search")).toBeInTheDocument());

    await user.keyboard("{ArrowUp}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toHaveFocus());
    expect(footer.queryByText("Clear Search")).not.toBeInTheDocument();
    expect(footer.getByText("Back")).toBeInTheDocument();
  });

  it("returns the zone to the page when focus comes back from the chrome", async () => {
    const user = userEvent.setup();
    renderWithChrome();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toHaveFocus());

    await user.tab();

    await waitFor(() => expect(search).toHaveFocus());
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText("Clear Search")).toBeInTheDocument();
  });

  it("hands focus from the top of search to the header Back button, keeps Escape leaving, and resumes native Tab", async () => {
    const user = userEvent.setup();
    renderWithChrome();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{ArrowUp}");

    const backButton = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(backButton).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(mockRouterNavigate).toHaveBeenCalledWith({ to: "/" });

    // The document-scope Tab cycle declines outside main: native Tab re-enters
    // the page at the search input instead of jumping to the sections pane.
    await user.tab();
    await waitFor(() => expect(search).toHaveFocus());
    expect(screen.getByRole("listbox", { name: /review sections/i })).not.toHaveFocus();
  });

  it("keeps ArrowUp native in the search input until the caret sits at the start", async () => {
    const user = userEvent.setup();
    renderWithChrome();

    const search = await screen.findByPlaceholderText<HTMLInputElement>(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await user.keyboard("abc");

    await user.keyboard("{ArrowUp}");

    expect(search).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveFocus();

    search.setSelectionRange(0, 0);
    await user.keyboard("{ArrowUp}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toHaveFocus());
  });

  it("leaves modified arrows native in the search input at caret start", async () => {
    const user = userEvent.setup();
    renderWithChrome();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await waitFor(() => expect(search).toHaveFocus());

    // The empty field's caret sits at 0, where a bare ArrowUp hands off; the
    // hand-off must still leave modified arrows native.
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    await user.keyboard("{Control>}{ArrowUp}{/Control}");

    expect(search).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveFocus();
  });

  it("hands focus from the top of the warnings region to the Back button, keeping ArrowUp for a scrolled region", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "readable-review" })],
      warnings: [
        { kind: "unreadable_review" as const, reviewId: "00000000-1111-4111-8111-111111111111" },
      ],
    });
    const user = userEvent.setup();
    renderWithChrome();

    const warningRegion = await screen.findByRole("region", { name: "History warnings" });
    warningRegion.focus();
    await waitFor(() => expect(warningRegion).toHaveFocus());

    // jsdom has no scroll layout; emulate a region scrolled below its top.
    Object.defineProperty(warningRegion, "scrollTop", {
      configurable: true,
      writable: true,
      value: 60,
    });
    await user.keyboard("{ArrowUp}");

    expect(warningRegion).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveFocus();

    warningRegion.scrollTop = 0;
    await user.keyboard("{ArrowUp}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toHaveFocus());
  });

  it("leaves modified arrows native in the warnings region at its top", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "readable-review" })],
      warnings: [
        { kind: "unreadable_review" as const, reviewId: "00000000-1111-4111-8111-111111111111" },
      ],
    });
    const user = userEvent.setup();
    renderWithChrome();

    const warningRegion = await screen.findByRole("region", { name: "History warnings" });
    warningRegion.focus();
    await waitFor(() => expect(warningRegion).toHaveFocus());

    // At scrollTop 0 a bare ArrowUp hands off; the ScrollArea contract keeps
    // modified arrows native, so these must not reach the chrome.
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    await user.keyboard("{Control>}{ArrowUp}{/Control}");

    expect(warningRegion).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveFocus();
  });
});
