import { useState } from "react";
import { useReviewLifecycleBase, useInit } from "@diffgazer/core/api/hooks";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import type { StepState, AgentState } from "@diffgazer/core/schemas/events";
import type { ReviewEvent, FileProgress } from "@diffgazer/core/review";

export type ReviewPhase =
  | "streaming"
  | "completing"
  | "summary"
  | "results";

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
  const [mode, setMode] = useState<ReviewMode>("staged");
  const [startCounter, setStartCounter] = useState(0);
  const [phase, setPhase] = useState<"streaming" | "summary" | "results">("streaming");

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;

  const lifecycle = useReviewLifecycleBase({
    mode,
    configLoading,
    settingsLoading: false,
    isConfigured,
    startToken: startCounter,
    onComplete: () => setPhase("summary"),
  });

  const displayPhase: ReviewLifecycleState["phase"] =
    !lifecycle.hasStarted ? "loading" : lifecycle.isCompleting ? "completing" : phase;

  function start(selectedMode: ReviewMode) {
    setMode(selectedMode);
    lifecycle.setHasStarted(false);
    setStartCounter((t) => t + 1);
  }

  function goToSummary() {
    lifecycle.skipDelay();
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
    lifecycle.resetCompletion();
    lifecycle.setHasStarted(false);
    lifecycle.setHasStreamed(false);
    setPhase("streaming");
    lifecycle.stream.abort();
  }

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    reviewId: lifecycle.streamState.reviewId ?? null,
    startedAt: lifecycle.streamState.startedAt,
    issues: lifecycle.streamState.issues,
    steps: lifecycle.streamState.steps,
    agents: lifecycle.streamState.agents,
    events: lifecycle.streamState.events,
    fileProgress: lifecycle.streamState.fileProgress,
    error: lifecycle.streamState.error,
    isConfigured,
    provider,
    model,
    isNoDiffError: lifecycle.isNoDiffError,
    isCheckingForChanges: lifecycle.isCheckingForChanges,
    loadingMessage: lifecycle.loadingMessage,
  };

  return { state, start, goToSummary, goToResults, reset };
}
