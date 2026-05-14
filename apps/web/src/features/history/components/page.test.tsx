import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { makeReview, renderWithProviders } from "@/testing";

const { mockNavigate, mockUseReview, mockUseReviews } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviews: vi.fn(),
}));

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
});
