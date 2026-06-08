import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate, mockCreateReview, mockUseReviewLifecycleBase } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reviewId: "11111111-1111-4111-8111-111111111111" }),
}));

vi.mock("@/hooks/use-config", () => ({
  useConfigData: () => ({
    isConfigured: true,
    provider: "openrouter",
    model: "openrouter/test-model",
    isLoading: false,
  }),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useCreateReview: () => ({ mutateAsync: mockCreateReview }),
  useReviewLifecycleBase: mockUseReviewLifecycleBase,
}));

import { useReviewLifecycle } from "./use-lifecycle";

function makeBaseReturn() {
  return {
    stream: {
      stop: vi.fn(),
      abort: vi.fn(),
      cancel: vi.fn(async () => null),
      state: {
        steps: [],
        agents: [],
        issues: [],
        events: [],
        fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
        isStreaming: false,
        error: "No unstaged changes found",
        startedAt: null,
        reviewId: "11111111-1111-4111-8111-111111111111",
      },
    },
    checks: { loadingMessage: null, isNoDiffError: true, isCheckingForChanges: false },
    completion: { isCompleting: false, skipDelay: vi.fn(), resetCompletion: vi.fn() },
    start: {
      hasStarted: true,
      hasStreamed: true,
      setHasStarted: vi.fn(),
      setHasStreamed: vi.fn(),
    },
  };
}

describe("useReviewLifecycle no-diff alternate start", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockUseReviewLifecycleBase.mockReset();
    mockUseReviewLifecycleBase.mockReturnValue(makeBaseReturn());
    mockCreateReview.mockResolvedValue({ reviewId: "22222222-2222-4222-8222-222222222222" });
  });

  it.each<[ReviewMode, ReviewMode]>([
    ["unstaged", "staged"],
    ["staged", "unstaged"],
    ["files", "unstaged"],
  ])("starts the alternate %s review instead of navigating home from %s", async (mode, alternateMode) => {
    const { result } = renderHook(() => useReviewLifecycle({ mode }));

    result.current.handleSwitchMode();

    await waitFor(() => {
      expect(mockCreateReview).toHaveBeenCalledWith({ mode: alternateMode });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
      search: { mode: alternateMode, live: true },
      replace: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
  });
});
