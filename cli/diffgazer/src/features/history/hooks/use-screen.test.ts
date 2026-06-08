/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHistoryScreen } from "./use-screen.js";

const useReviewsMock = vi.hoisted(() => vi.fn());
const useReviewMock = vi.hoisted(() => vi.fn());

vi.mock("@diffgazer/core/api/hooks", () => ({
  useReviews: useReviewsMock,
  useReview: useReviewMock,
}));

describe("useHistoryScreen", () => {
  it("opens a saved review by reviewId without starting a new unstaged review", () => {
    const onOpenReview = vi.fn();
    useReviewsMock.mockReturnValue({
      data: {
        reviews: [
          {
            id: "history-review-1",
            projectPath: "/proj",
            createdAt: "2025-06-01T00:00:00.000Z",
            mode: "staged",
            branch: "main",
            profile: null,
            lenses: ["correctness"],
            issueCount: 1,
            blockerCount: 0,
            highCount: 1,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 0,
            fileCount: 1,
          },
        ],
      },
    });
    useReviewMock.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useHistoryScreen({ onOpenReview }));

    result.current.handleRunActivate("history-review-1");

    expect(onOpenReview).toHaveBeenCalledWith("history-review-1");
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });
});
