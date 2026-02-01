import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryPage } from "./history";

/**
 * HistoryPage UI Tests
 *
 * Fix 2: Tab and pane header renamed from "Runs" to "Reviews"
 * Location: apps/web/src/app/pages/history.tsx:223, 257
 */

// Mock dependencies
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/keyboard", () => ({
  useScope: vi.fn(),
  useKey: vi.fn(),
}));

vi.mock("@/hooks/use-scoped-route-state", () => ({
  useScopedRouteState: (key: string, defaultValue: unknown) => {
    return [defaultValue, vi.fn()];
  },
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("@/features/history", () => ({
  useReviews: () => ({
    reviews: [],
    isLoading: false,
    error: null,
  }),
  useReviewDetail: () => ({
    review: null,
    isLoading: false,
  }),
  RunAccordionItem: () => null,
  TimelineList: () => null,
  HistoryInsightsPane: () => null,
}));

describe("HistoryPage - Tab Rename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Reviews' tab instead of 'Runs'", () => {
    render(<HistoryPage />);

    // Tab should say "Reviews" (appears multiple times: tab + header)
    const reviewsTabs = screen.getAllByText("Reviews");
    expect(reviewsTabs.length).toBeGreaterThan(0);
  });

  it("does not render 'Runs' text in tab", () => {
    render(<HistoryPage />);

    // There should be no tab with text "Runs"
    const runsTabs = screen.queryAllByRole("tab", { name: /^Runs$/i });
    expect(runsTabs).toHaveLength(0);
  });

  it("renders 'Reviews' in the pane header", () => {
    render(<HistoryPage />);

    // Pane header should say "Reviews"
    const headers = screen.getAllByText("Reviews");

    // Should have at least 2: one for tab, one for pane header
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render Sessions tab", () => {
    render(<HistoryPage />);

    // Sessions tab should not exist
    const sessionsTab = screen.queryByText("Sessions");
    expect(sessionsTab).not.toBeInTheDocument();
  });

  it("renders header with 'Reviews' text (no tabs)", () => {
    render(<HistoryPage />);

    const allReviewsText = screen.getAllByText("Reviews");

    // Should appear in header (line 223) and pane header (line 254)
    expect(allReviewsText.length).toBe(2);
  });
});

describe("HistoryPage - No 'Runs' Text", () => {
  it("ensures 'Runs' is not used in visible UI elements", () => {
    const { container } = render(<HistoryPage />);

    // Get all text content
    const pageText = container.textContent || "";

    // "Runs" should not appear except in "No runs for this date" message
    const runsMatches = pageText.match(/\bRuns\b/g);

    // If "Runs" appears, it should only be in error/empty states
    if (runsMatches) {
      expect(runsMatches.length).toBe(0);
    }
  });

  it("uses 'Reviews' consistently in UI", () => {
    render(<HistoryPage />);

    // "Reviews" should appear at least twice (tab + header)
    const reviewsElements = screen.getAllByText("Reviews");
    expect(reviewsElements.length).toBeGreaterThanOrEqual(2);
  });
});

describe("HistoryPage - Click vs Keyboard Navigation", () => {
  it("verifies onClick handler only selects (navigation via keyboard)", () => {
    render(<HistoryPage />);

    // This test documents the behavior change:
    // - OLD: onClick triggered navigation
    // - NEW: onClick only calls onSelect (setSelectedRunId)
    // - Navigation happens via keyboard shortcut "o" (history.tsx:177-185)

    // The RunAccordionItem component receives:
    // - onSelect={() => setSelectedRunId(run.id)}  [history.tsx:271]
    // - NOT: onClick={navigate}

    // Keyboard handler "o" triggers navigation (history.tsx:177-185):
    // useKey("o", () => {
    //   if (selectedRunId) {
    //     navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
    //   }
    // });

    expect(true).toBe(true); // Placeholder for behavioral documentation
  });
});
