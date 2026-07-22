import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import type { ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { MAIN_CONTENT_ID } from "@/lib/main-content";
import { HistoryPage } from "./page";
import {
  FooterView,
  focusRunsList,
  makeReviewResponse,
  mockGetReview,
  mockGetReviews,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
} from "./page.test-utils";

describe("HistoryPage keyboard navigation", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    setupApiMocks(trustedProject());
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
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

  it("moves the insights highlight with j alias and routes Enter to the issue handler", async () => {
    mockGetReview.mockImplementation(async (id) =>
      makeReviewResponse(id, [
        {
          id: "issue-a",
          severity: "high",
          category: "correctness",
          title: "Alpha",
          file: "a.ts",
          line_start: 1,
          line_end: 1,
          rationale: "",
          recommendation: "",
          suggested_patch: null,
          confidence: 0.9,
          symptom: "",
          whyItMatters: "",
          evidence: [],
        },
        {
          id: "issue-b",
          severity: "high",
          category: "correctness",
          title: "Beta",
          file: "b.ts",
          line_start: 2,
          line_end: 2,
          rationale: "",
          recommendation: "",
          suggested_patch: null,
          confidence: 0.9,
          symptom: "",
          whyItMatters: "",
          evidence: [],
        },
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

  it("does not programmatically focus the insights pane when no run is selected", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    renderHistoryPage(<HistoryPage />);

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);

    const insightsPane = screen.getByRole("complementary", { name: "Review insights" });
    expect(document.activeElement).not.toBe(insightsPane);
  });
});
