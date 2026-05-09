import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";

const { mockNavigate, mockUseReview, mockUseReviews } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviews: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

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

function makeReview(id: string): ReviewMetadata {
  return {
    id,
    projectPath: "/repo",
    createdAt: "2026-02-09T12:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: [],
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 1,
    durationMs: 1200,
  };
}

function renderPage() {
  return render(
    <KeyboardProvider>
      <HistoryPage />
    </KeyboardProvider>,
  );
}

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
          makeReview("11111111-1111-4111-8111-111111111111"),
          makeReview("22222222-2222-4222-8222-222222222222"),
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
    renderPage();

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

  it("opens the highlighted run with the open shortcut", async () => {
    const user = userEvent.setup();
    renderPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{ArrowDown}o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });
});
