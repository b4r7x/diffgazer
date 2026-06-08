import { usePageFooter } from "@diffgazer/core/footer";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const useReviewMock = vi.hoisted(() => vi.fn());
const useNavigationMock = vi.hoisted(() => vi.fn());

vi.mock("@diffgazer/core/api/hooks", () => ({
  useReview: useReviewMock,
}));

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("../../../hooks/use-back-handler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("../../../hooks/use-navigation", () => ({
  useNavigation: useNavigationMock,
}));

vi.mock("../../../hooks/use-scope", () => ({
  useScope: vi.fn(),
}));

vi.mock("./container.js", () => ({
  ReviewContainer: ({ reviewId, mode }: { reviewId?: string; mode?: string }) => (
    <Text>{`stream:${reviewId ?? "none"}:${mode ?? "none"}`}</Text>
  ),
}));

vi.mock("./results-view.js", () => ({
  ReviewResultsView: () => <Text>saved-results</Text>,
}));

vi.mock("./summary-view.js", () => ({
  ReviewSummaryView: () => <Text>saved-summary</Text>,
}));

import { ReviewScreen } from "./screen.js";

afterEach(() => {
  cleanup();
});

describe("ReviewScreen", () => {
  beforeEach(() => {
    vi.mocked(usePageFooter).mockReset();
    useNavigationMock.mockReturnValue({
      route: { screen: "review", reviewId: "review-123", mode: "staged" },
      goBack: vi.fn(),
    });
  });

  test("passes the routed reviewId into the streaming container when no saved review is loaded", () => {
    useReviewMock.mockReturnValue({ isLoading: false, data: undefined });

    const { lastFrame } = render(<ReviewScreen />);

    expect(lastFrame()).toContain("stream:review-123:staged");
  });

  test("renders the saved review path when saved review data is available", () => {
    useReviewMock.mockReturnValue({
      isLoading: false,
      data: { review: { metadata: { id: "review-123", durationMs: 10 }, result: { issues: [] } } },
    });

    const { lastFrame } = render(<ReviewScreen />);

    expect(lastFrame()).toContain("saved-summary");
  });
});
