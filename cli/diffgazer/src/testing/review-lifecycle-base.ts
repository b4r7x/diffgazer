import type { UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import type { FileProgress, ReviewEvent } from "@diffgazer/core/review";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { vi } from "vitest";

type ReviewLifecycleBase = UseReviewLifecycleBaseResult;

export interface ReviewLifecycleBaseOverrides {
  abort?: () => void;
  agents?: AgentState[];
  cancel?: ReviewLifecycleBase["stream"]["cancel"];
  completedAt?: Date | null;
  error?: string | null;
  errorCode?: string | null;
  events?: ReviewEvent[];
  fileProgress?: FileProgress;
  gate?: ReviewLifecycleBase["gate"];
  hasStarted?: boolean;
  hasStreamed?: boolean;
  isCheckingForChanges?: boolean;
  isCompleting?: boolean;
  isNoDiffError?: boolean;
  isStreaming?: boolean;
  isTerminalStreamError?: boolean;
  issues?: ReviewIssue[];
  reviewId?: string | null;
  startedAt?: Date | null;
  steps?: StepState[];
}

function resolveGate({
  gate,
  isNoDiffError,
  isTerminalStreamError,
}: {
  gate?: ReviewLifecycleBase["gate"];
  isNoDiffError: boolean;
  isTerminalStreamError: boolean;
}): ReviewLifecycleBase["gate"] {
  if (gate) return gate;
  if (isTerminalStreamError) return "terminal-error";
  if (isNoDiffError) return "no-diff";
  return "running";
}

export function makeReviewLifecycleBase(
  overrides: ReviewLifecycleBaseOverrides = {},
): UseReviewLifecycleBaseResult {
  const isNoDiffError = overrides.isNoDiffError ?? false;
  const isTerminalStreamError = overrides.isTerminalStreamError ?? false;

  return {
    stream: {
      stop: vi.fn(),
      abort: overrides.abort ?? vi.fn(),
      cancel: overrides.cancel ?? vi.fn(async () => null),
      state: {
        steps: overrides.steps ?? [{ id: "diff", label: "Diff", status: "completed" }],
        agents: overrides.agents ?? [],
        issues: overrides.issues ?? [makeIssue({ id: "issue-1", title: "Completed issue" })],
        events: overrides.events ?? [],
        fileProgress: overrides.fileProgress ?? {
          total: 1,
          current: 1,
          currentFile: null,
          completed: ["src/index.ts"],
        },
        notices: [],
        hasCompleted: false,
        isStreaming: overrides.isStreaming ?? false,
        error: overrides.error ?? null,
        errorCode: overrides.errorCode ?? null,
        startedAt:
          overrides.startedAt === undefined
            ? new Date("2026-01-01T00:00:00.000Z")
            : overrides.startedAt,
        reviewId: overrides.reviewId === undefined ? "review-123" : overrides.reviewId,
      },
    },
    checks: {
      isNoDiffError,
      isTerminalStreamError,
      isCheckingForChanges: overrides.isCheckingForChanges ?? false,
      loadingMessage: null,
    },
    completion: {
      isCompleting: overrides.isCompleting ?? false,
      completedAt: overrides.completedAt ?? null,
      skipDelay: vi.fn(),
      resetCompletion: vi.fn(),
    },
    start: {
      hasStarted: overrides.hasStarted ?? true,
      hasStreamed: overrides.hasStreamed ?? true,
      setHasStarted: vi.fn(),
      setHasStreamed: vi.fn(),
    },
    gate: resolveGate({ gate: overrides.gate, isNoDiffError, isTerminalStreamError }),
    contextReady: false,
    contextSnapshot: null,
  };
}
