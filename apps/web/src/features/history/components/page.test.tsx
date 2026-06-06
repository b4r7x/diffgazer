import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { makeReview } from "@/testing/factories";
import { renderWithProviders } from "@/testing/render";

const { mockNavigate, mockUseReview, mockUseReviews } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviews: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@diffgazer/core/api/hooks")>(
    "@diffgazer/core/api/hooks",
  );

  return {
    ...actual,
    useReview: mockUseReview,
    useReviews: mockUseReviews,
  };
});

import { HistoryPage } from "./page";

describe("HistoryPage keyboard navigation", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
    mockUseReviews.mockReset();
    mockUseReview.mockReset();
    mockUseReviews.mockReturnValue({
      data: {
        reviews: [
          makeReview({ id: "11111111-1111-4111-8111-111111111111" }),
          makeReview({ id: "22222222-2222-4222-8222-222222222222" }),
        ],
      },
      error: null,
      isLoading: false,
    });
    mockUseReview.mockReturnValue({
      data: {
        review: {
          result: {
            issues: [],
          },
        },
      },
      error: null,
      isLoading: false,
    });
  });

  it("moves focus from timeline to runs at the boundary and opens the highlighted run", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.click(screen.getByPlaceholderText(/search runs by id/i));
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
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Feb 9" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the highlighted run with the open shortcut", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{ArrowDown}o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("focuses search with slash without typing slash into the field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("/");

    const search = screen.getByPlaceholderText(/search runs by id/i);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("marks the selected run with data-active so theming can invert chip colors", async () => {
    mockUseReviews.mockReturnValue({
      data: {
        reviews: [
          makeReview({
            id: "33333333-3333-4333-8333-333333333333",
            lowCount: 3,
            nitCount: 2,
            issueCount: 5,
          }),
        ],
      },
      error: null,
      isLoading: false,
    });

    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const options = within(runsList).getAllByRole("option");
    const [activeRun] = options;
    if (activeRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(activeRun).toHaveAttribute("data-active", "true"));

    expect(within(activeRun).getByText(/3 low/i)).toBeInTheDocument();
    expect(within(activeRun).getByText(/2 nit/i)).toBeInTheDocument();
  });

  it("never marks more than one panel as focused as Tab moves the focus zone", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    // querySelector retained: pane has no accessible role; structural assertion is the contract (counting how many [data-pane] elements carry the focused state)
    const focusedPanels = () => document.querySelectorAll('[data-pane][data-focused="true"]');

    await waitFor(() => expect(focusedPanels().length).toBe(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));
  });

  it("does not include runs or insights in the Tab cycle when there are no runs", async () => {
    mockUseReviews.mockReturnValue({
      data: { reviews: [] },
      error: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const search = await screen.findByPlaceholderText(/search runs by id/i);
    search.focus();
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Tab}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("moves the insights highlight with j alias and routes Enter to the issue handler", async () => {
    mockUseReview.mockReturnValue({
      data: {
        review: {
          result: {
            issues: [
              { id: "issue-a", severity: "high", category: "correctness", title: "Alpha", file: "a.ts", line_start: 1, line_end: 1, rationale: "", recommendation: "", suggested_patch: null, confidence: 0.9, symptom: "", whyItMatters: "", evidence: [], enrichment: undefined },
              { id: "issue-b", severity: "high", category: "correctness", title: "Beta",  file: "b.ts", line_start: 2, line_end: 2, rationale: "", recommendation: "", suggested_patch: null, confidence: 0.9, symptom: "", whyItMatters: "", evidence: [], enrichment: undefined },
            ],
          },
        },
      },
      error: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<HistoryPage />);

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

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

  it("does not programmatically focus the insights pane when no run is selected", async () => {
    mockUseReviews.mockReturnValue({
      data: { reviews: [] },
      error: null,
      isLoading: false,
    });

    renderWithProviders(<HistoryPage />);

    await screen.findByPlaceholderText(/search runs by id/i);

    // querySelector retained: pane has no accessible role; structural assertion is the contract (verifying the insights pane element exists and is NOT focused)
    const insightsPane = document.querySelector('[data-pane="insights"]');
    expect(insightsPane).not.toBeNull();
    expect(document.activeElement).not.toBe(insightsPane);
  });
});
