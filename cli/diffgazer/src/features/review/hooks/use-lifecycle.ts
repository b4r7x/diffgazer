import { useCreateReview, useInit, useReviewLifecycleBase } from "@diffgazer/core/api/hooks";
import type { FileProgress, ReviewEvent } from "@diffgazer/core/review";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import { useState } from "react";

export type ReviewPhase =
  | "streaming"
  | "completing"
  | "summary"
  | "results";

type LifecyclePhase = ReviewPhase | "loading";

export function getDisplayPhase(input: {
  hasStartFailed: boolean;
  hasStarted: boolean;
  isCompleting: boolean;
  phase: "streaming" | "summary" | "results";
}): LifecyclePhase {
  if (input.hasStartFailed) return "summary";
  if (!input.hasStarted) return "loading";
  if (input.isCompleting) return "completing";
  return input.phase;
}

export interface ReviewLifecycleState {
  phase: ReviewPhase | "loading";
  reviewId: string | null;
  startedAt: Date | null;
  issues: ReviewIssue[];
  steps: StepState[];
  agents: AgentState[];
  events: ReviewEvent[];
  fileProgress: FileProgress;
  error: string | null;
  isConfigured: boolean;
  provider: string | null;
  model: string | null;
  isNoDiffError: boolean;
  isCheckingForChanges: boolean;
  loadingMessage: string | null;
}

export function useReviewLifecycle(): {
  state: ReviewLifecycleState;
  start: (mode: ReviewMode) => void;
  goToSummary: () => void;
  goToResults: () => void;
  reset: () => void;
} {
  const { data: initData, isLoading: configLoading } = useInit();
  const createReview = useCreateReview();
  const [mode, setMode] = useState<ReviewMode>("staged");
  const [reviewId, setReviewId] = useState<string | undefined>();
  const [phase, setPhase] = useState<"streaming" | "summary" | "results">("streaming");
  const [startError, setStartError] = useState<string | null>(null);

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;

  const lifecycle = useReviewLifecycleBase({
    mode,
    configLoading,
    isConfigured,
    reviewId,
    onComplete: () => setPhase("summary"),
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
    lifecycle.stream.abort();
    lifecycle.completion.resetCompletion();
    lifecycle.start.setHasStarted(false);
    lifecycle.start.setHasStreamed(false);
    setPhase("streaming");
    try {
      const result = await createReview.mutateAsync({ mode: selectedMode });
      setReviewId(result.reviewId);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    }
  }

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
    setReviewId(undefined);
    lifecycle.stream.abort();
  }

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    reviewId: lifecycle.stream.state.reviewId ?? null,
    startedAt: lifecycle.stream.state.startedAt,
    issues: lifecycle.stream.state.issues,
    steps: lifecycle.stream.state.steps,
    agents: lifecycle.stream.state.agents,
    events: lifecycle.stream.state.events,
    fileProgress: lifecycle.stream.state.fileProgress,
    error: startError ?? lifecycle.stream.state.error,
    isConfigured,
    provider,
    model,
    isNoDiffError: lifecycle.checks.isNoDiffError,
    isCheckingForChanges: lifecycle.checks.isCheckingForChanges,
    loadingMessage: lifecycle.checks.loadingMessage,
  };

  return { state, start, goToSummary, goToResults, reset };
}
