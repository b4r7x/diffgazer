import type { ReviewGate, UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import {
  useCreateReview,
  useInit,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import type {
  FileProgress,
  OrchestratorStats,
  ReviewEvent,
  ReviewScreenPhase,
} from "@diffgazer/core/review";
import {
  describeReviewStartError,
  extractOrchestratorStats,
  sessionTerminationCopy,
} from "@diffgazer/core/review";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import { useEffect, useState } from "react";

type LifecyclePhase = ReviewScreenPhase | "completing" | "loading";
type ReviewInitState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; missing: SetupStatus["missing"] };

type ReviewStartResult = "started" | "setup-required" | "failed";

export function getDisplayPhase(input: {
  hasStartFailed: boolean;
  hasStarted: boolean;
  isCompleting: boolean;
  phase: ReviewScreenPhase;
}): LifecyclePhase {
  if (input.hasStartFailed) return "summary";
  if (!input.hasStarted) return "loading";
  if (input.isCompleting) return "completing";
  return input.phase;
}

export interface ReviewLifecycleState {
  phase: LifecyclePhase;
  gate: ReviewGate;
  contextSnapshot: UseReviewLifecycleBaseResult["contextSnapshot"];
  mode: ReviewMode;
  reviewId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  issues: ReviewIssue[];
  steps: StepState[];
  agents: AgentState[];
  events: ReviewEvent[];
  completion: OrchestratorStats;
  fileProgress: FileProgress;
  notices: string[];
  error: string | null;
  errorCode: string | null;
  isStreaming: boolean;
  provider: string | null;
  initState: ReviewInitState;
  loadingMessage: string | null;
}

interface UseReviewLifecycleOptions {
  mode?: ReviewMode;
  reviewId?: string;
  allowResumeWithoutSetup?: boolean;
}

export function useReviewLifecycle(options: UseReviewLifecycleOptions = {}): {
  state: ReviewLifecycleState;
  start: (mode: ReviewMode) => Promise<ReviewStartResult>;
  cancel: () => Promise<string | null>;
  goToSummary: () => void;
  goToResults: () => void;
  retryConfig: () => Promise<void>;
  reset: (options?: { clearActiveSession?: boolean }) => void;
} {
  const initQuery = useInit();
  const initData = initQuery.data;
  const createReview = useCreateReview();
  const { clearActiveSession: clearCachedActiveSession } = useReviewSessionCache();
  const [mode, setMode] = useState<ReviewMode>(options.mode ?? "staged");
  const [startedReviewId, setStartedReviewId] = useState<string | undefined>();
  const [phase, setPhase] = useState<ReviewScreenPhase>("streaming");
  const [startError, setStartError] = useState<string | null>(null);
  const requestedReviewId = startedReviewId ?? options.reviewId;

  const isConfigured = initData?.setup.isConfigured ?? false;
  const provider = initData?.config?.provider ?? null;
  let initState: ReviewInitState;
  if (initData) {
    initState = { status: "ready", missing: initData.setup.missing };
  } else if (initQuery.isLoading || initQuery.isFetching) {
    initState = { status: "loading" };
  } else {
    initState = {
      status: "error",
      message: getErrorMessage(initQuery.error, "Unable to load configuration."),
    };
  }

  function clearActiveSessionForReview(reviewId: string | null | undefined) {
    if (reviewId) {
      clearCachedActiveSession(mode, reviewId);
    }
  }

  const lifecycle = useReviewLifecycleBase({
    configLoading: initState.status === "loading",
    isConfigured,
    allowResumeWithoutSetup: options.allowResumeWithoutSetup,
    reviewId: requestedReviewId,
    onStreamComplete: () => {
      clearActiveSessionForReview(requestedReviewId);
    },
    onComplete: () => {
      clearActiveSessionForReview(requestedReviewId);
      setPhase("summary");
    },
    onNotFoundInSession: (reviewId) => {
      clearActiveSessionForReview(reviewId);
      setStartError("Review session not found.");
    },
    onStaleSession: (code) => {
      clearActiveSessionForReview(requestedReviewId);
      setStartError(sessionTerminationCopy(code).message);
    },
  });

  const terminalReviewId = lifecycle.stream.state.reviewId ?? requestedReviewId ?? null;
  const completion = extractOrchestratorStats(lifecycle.stream.state);

  useEffect(() => {
    if (lifecycle.checks.isNoDiffError && terminalReviewId) {
      clearCachedActiveSession(mode, terminalReviewId);
    }
  }, [clearCachedActiveSession, lifecycle.checks.isNoDiffError, mode, terminalReviewId]);

  const hasStartFailed = startError !== null;
  // When start fails we drop the "loading" / "completing" guards so the
  // container's `state.error && phase !== streaming/completing` Callout fires.
  const displayPhase = getDisplayPhase({
    hasStartFailed,
    hasStarted: lifecycle.start.hasStarted,
    isCompleting: lifecycle.completion.isCompleting,
    phase,
  });

  async function start(selectedMode: ReviewMode): Promise<ReviewStartResult> {
    if (!isConfigured) {
      return "setup-required";
    }
    setMode(selectedMode);
    setStartError(null);
    setStartedReviewId(undefined);
    lifecycle.stream.abort();
    lifecycle.completion.resetCompletion();
    lifecycle.start.setHasStarted(false);
    lifecycle.start.setHasStreamed(false);
    setPhase("streaming");
    try {
      const result = await createReview.mutateAsync({ mode: selectedMode });
      setStartedReviewId(result.reviewId);
      return "started";
    } catch (err) {
      const description = describeReviewStartError(err);
      setStartError(`${description.title}: ${description.message}`);
      return "failed";
    }
  }

  async function cancel(): Promise<string | null> {
    const reviewId = lifecycle.stream.state.reviewId ?? requestedReviewId ?? null;
    const error = await lifecycle.stream.cancel(reviewId);
    if (!error) {
      clearActiveSessionForReview(reviewId);
    }
    return error;
  }

  function goToSummary() {
    lifecycle.completion.skipDelay();
  }

  function goToResults() {
    setPhase("results");
  }

  async function retryConfig(): Promise<void> {
    await initQuery.refetch();
  }

  function reset(options: { clearActiveSession?: boolean } = {}) {
    if (options.clearActiveSession) {
      clearActiveSessionForReview(terminalReviewId);
    }
    setStartError(null);
    lifecycle.completion.resetCompletion();
    lifecycle.start.setHasStarted(false);
    lifecycle.start.setHasStreamed(false);
    setPhase("streaming");
    setStartedReviewId(undefined);
    lifecycle.stream.abort();
  }

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    gate: lifecycle.gate,
    contextSnapshot: lifecycle.contextSnapshot,
    mode,
    reviewId: lifecycle.stream.state.reviewId ?? requestedReviewId ?? null,
    startedAt: lifecycle.stream.state.startedAt,
    completedAt: lifecycle.completion.completedAt,
    issues: lifecycle.stream.state.issues,
    steps: lifecycle.stream.state.steps,
    agents: lifecycle.stream.state.agents,
    events: lifecycle.stream.state.events,
    completion,
    fileProgress: lifecycle.stream.state.fileProgress,
    notices: lifecycle.stream.state.notices,
    error: startError ?? lifecycle.stream.state.error,
    errorCode: startError ? null : lifecycle.stream.state.errorCode,
    isStreaming: lifecycle.stream.state.isStreaming,
    provider,
    initState,
    loadingMessage: lifecycle.checks.loadingMessage,
  };

  return { state, start, cancel, goToSummary, goToResults, retryConfig, reset };
}
