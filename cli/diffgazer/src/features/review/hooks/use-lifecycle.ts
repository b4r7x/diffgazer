import type { ReviewGate, UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import { useCreateReview, useInit, useReviewLifecycleBase } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { FileProgress, ReviewEvent, ReviewScreenPhase } from "@diffgazer/core/review";
import { sessionTerminationCopy } from "@diffgazer/core/review";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import { useState } from "react";

type LifecyclePhase = ReviewScreenPhase | "completing" | "loading";

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
  issues: ReviewIssue[];
  steps: StepState[];
  agents: AgentState[];
  events: ReviewEvent[];
  fileProgress: FileProgress;
  notices: string[];
  error: string | null;
  isConfigured: boolean;
  provider: string | null;
  model: string | null;
  isNoDiffError: boolean;
  isCheckingForChanges: boolean;
  loadingMessage: string | null;
}

interface UseReviewLifecycleOptions {
  mode?: ReviewMode;
  reviewId?: string;
}

export function useReviewLifecycle(options: UseReviewLifecycleOptions = {}): {
  state: ReviewLifecycleState;
  start: (mode: ReviewMode) => void;
  cancel: () => Promise<string | null>;
  goToSummary: () => void;
  goToResults: () => void;
  reset: () => void;
} {
  const { data: initData, isLoading: configLoading } = useInit();
  const createReview = useCreateReview();
  const [mode, setMode] = useState<ReviewMode>(options.mode ?? "staged");
  const [startedReviewId, setStartedReviewId] = useState<string | undefined>();
  const [phase, setPhase] = useState<ReviewScreenPhase>("streaming");
  const [startError, setStartError] = useState<string | null>(null);
  const requestedReviewId = options.reviewId ?? startedReviewId;

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;

  const lifecycle = useReviewLifecycleBase({
    configLoading,
    isConfigured,
    reviewId: requestedReviewId,
    onComplete: () => setPhase("summary"),
    onNotFoundInSession: () => {
      setStartError("Review session not found.");
    },
    onStaleSession: (code) => {
      setStartError(sessionTerminationCopy(code).message);
    },
  });

  const hasStartFailed = startError !== null;
  // When start fails we drop the "loading" / "completing" guards so the
  // container's `state.error && phase !== streaming/completing` Callout fires.
  const displayPhase = getDisplayPhase({
    hasStartFailed,
    hasStarted: lifecycle.start.hasStarted,
    isCompleting: lifecycle.completion.isCompleting,
    phase,
  });

  async function start(selectedMode: ReviewMode) {
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
    } catch (err) {
      setStartError(getErrorMessage(err));
    }
  }

  const cancel = (): Promise<string | null> =>
    lifecycle.stream.cancel(
      lifecycle.stream.state.reviewId ?? startedReviewId ?? options.reviewId ?? null,
    );

  function goToSummary() {
    lifecycle.completion.skipDelay();
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
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
    reviewId: lifecycle.stream.state.reviewId ?? startedReviewId ?? options.reviewId ?? null,
    startedAt: lifecycle.stream.state.startedAt,
    issues: lifecycle.stream.state.issues,
    steps: lifecycle.stream.state.steps,
    agents: lifecycle.stream.state.agents,
    events: lifecycle.stream.state.events,
    fileProgress: lifecycle.stream.state.fileProgress,
    notices: lifecycle.stream.state.notices,
    error: startError ?? lifecycle.stream.state.error,
    isConfigured,
    provider,
    model,
    isNoDiffError: lifecycle.checks.isNoDiffError,
    isCheckingForChanges: lifecycle.checks.isCheckingForChanges,
    loadingMessage: lifecycle.checks.loadingMessage,
  };

  return { state, start, cancel, goToSummary, goToResults, reset };
}
