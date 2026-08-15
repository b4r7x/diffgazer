import type { UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import { ok } from "@diffgazer/core/result";
import type {
  FileProgress,
  OrchestratorStats,
  ReviewEvent,
  ReviewStateErrorCode,
} from "@diffgazer/core/review";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { vi } from "vitest";

type ReviewLifecycleBase = UseReviewLifecycleBaseResult;

// Mirrors the reducer: a supplied orchestrator_complete event is also what puts
// the run's lens stats on stream state, so fixtures that pass one get both.
function statsFromEvents(events: readonly ReviewEvent[]): OrchestratorStats {
  const complete = events.findLast((event) => event.type === "orchestrator_complete");
  if (!complete) return {};
  return {
    lensStats: complete.lensStats,
    droppedDuplicates: complete.droppedDuplicates,
    droppedBelowThreshold: complete.droppedBelowThreshold,
    minSeverity: complete.minSeverity,
  };
}

export interface ReviewLifecycleBaseOverrides {
  agents?: AgentState[];
  cancel?: ReviewLifecycleBase["stream"]["cancel"];
  completedAt?: Date | null;
  error?: string | null;
  errorCode?: ReviewStateErrorCode | null;
  events?: ReviewEvent[];
  fileProgress?: FileProgress;
  gate?: ReviewLifecycleBase["gate"];
  hasStarted?: boolean;
  isCompleting?: boolean;
  isNoDiffError?: boolean;
  isStreaming?: boolean;
  isTerminalStreamError?: boolean;
  issues?: ReviewIssue[];
  reset?: () => void;
  reviewId?: string | null;
  resume?: ReviewLifecycleBase["stream"]["resume"];
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
      abort: vi.fn(),
      cancel:
        overrides.cancel ??
        vi.fn(async () => ({ status: "cancelled" as const, reason: "cancelled" as const })),
      resume: overrides.resume ?? vi.fn(async () => ok(undefined)),
      isStreamControllerActive: vi.fn(() => false),
      state: {
        steps: overrides.steps ?? [{ id: "diff", label: "Diff", status: "completed" }],
        agents: overrides.agents ?? [],
        issues: overrides.issues ?? [makeIssue({ id: "issue-1", title: "Completed issue" })],
        events: overrides.events ?? [],
        fileProgress: overrides.fileProgress ?? {
          total: 1,
          completed: ["src/index.ts"],
        },
        notices: [],
        orchestratorStats: statsFromEvents(overrides.events ?? []),
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
      loadingMessage: null,
    },
    completion: {
      isCompleting: overrides.isCompleting ?? false,
      completedAt: overrides.completedAt ?? null,
      skipDelay: vi.fn(),
    },
    start: {
      hasStarted: overrides.hasStarted ?? true,
      canStart: overrides.gate !== "unconfigured",
    },
    reset: overrides.reset ?? vi.fn(),
    resumeReview: vi.fn(async () => ok(undefined)),
    gate: resolveGate({ gate: overrides.gate, isNoDiffError, isTerminalStreamError }),
    contextSnapshot: null,
    contextRefreshError: null,
    retryContextRefresh: vi.fn(),
  };
}
