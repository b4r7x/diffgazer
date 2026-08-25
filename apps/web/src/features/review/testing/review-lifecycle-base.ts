import type { UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import { createInitialReviewState } from "@diffgazer/core/review";
import { vi } from "vitest";

type ReviewLifecycleBase = UseReviewLifecycleBaseResult;
type ReviewStreamState = ReviewLifecycleBase["stream"]["state"];

export interface ReviewLifecycleBaseOverrides
  extends Partial<Omit<ReviewLifecycleBase, "stream" | "checks" | "completion" | "start">> {
  stream?: Partial<Omit<ReviewLifecycleBase["stream"], "state">> & {
    state?: Partial<ReviewStreamState>;
  };
  checks?: Partial<ReviewLifecycleBase["checks"]>;
  completion?: Partial<ReviewLifecycleBase["completion"]>;
  start?: Partial<ReviewLifecycleBase["start"]>;
}

export function makeReviewLifecycleBase(
  overrides: ReviewLifecycleBaseOverrides = {},
): ReviewLifecycleBase {
  const { stream, checks, completion, start, ...rest } = overrides;
  const { state, ...streamHandles } = stream ?? {};

  return {
    stream: {
      state: {
        ...createInitialReviewState(),
        reviewId: null,
        hasCompleted: false,
        notices: [],
        sizeWarning: null,
        ...state,
      },
      abort: vi.fn(),
      cancel: vi.fn().mockResolvedValue(null),
      resume: vi.fn().mockResolvedValue(undefined),
      isStreamControllerActive: vi.fn().mockReturnValue(false),
      ...streamHandles,
    },
    checks: {
      isNoDiffError: false,
      isTerminalStreamError: false,
      loadingMessage: null,
      ...checks,
    },
    completion: {
      isCompleting: false,
      completedAt: null,
      skipDelay: vi.fn(),
      ...completion,
    },
    start: {
      hasStarted: true,
      canStart: true,
      ...start,
    },
    resumeReview: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    gate: "running",
    contextSnapshot: null,
    contextRefreshError: null,
    retryContextRefresh: vi.fn(),
    ...rest,
  };
}
