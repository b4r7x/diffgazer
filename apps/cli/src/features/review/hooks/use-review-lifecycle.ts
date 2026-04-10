import { useState } from "react";
import { useReviewLifecycleBase, useInit } from "@diffgazer/api/hooks";
import type { ReviewIssue, ReviewMode } from "@diffgazer/schemas/review";
import type { StepState, AgentState } from "@diffgazer/schemas/events";
import type { ReviewEvent, FileProgress } from "@diffgazer/core/review";

export type ReviewPhase =
  | "streaming"
  | "completing"
  | "summary"
  | "results";

export interface ReviewLifecycleState {
  phase: ReviewPhase | "loading";
  reviewId: string | null;
  durationMs: number | undefined;
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
  const [startToken, setStartToken] = useState(0);
  const [phase, setPhase] = useState<"streaming" | "summary" | "results">("streaming");

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;

  const base = useReviewLifecycleBase({
    mode,
    configLoading,
    settingsLoading: false,
    isConfigured,
    startToken,
    onComplete: () => setPhase("summary"),
  });

  const displayPhase: ReviewLifecycleState["phase"] =
    !base.hasStarted ? "loading" : base.isCompleting ? "completing" : phase;

  function start(mode: ReviewMode) {
    setMode(mode);
    base.setHasStarted(false);
    setStartToken((t) => t + 1);
  }

  function goToSummary() {
    base.skipDelay();
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
    base.resetCompletion();
    base.setHasStarted(false);
    base.setHasStreamed(false);
    setPhase("streaming");
    base.stream.abort();
  }

  const durationMs =
    base.streamState.startedAt
      ? Date.now() - base.streamState.startedAt.getTime()
      : undefined;

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    reviewId: base.streamState.reviewId ?? null,
    durationMs,
    startedAt: base.streamState.startedAt,
    issues: base.streamState.issues,
    steps: base.streamState.steps,
    agents: base.streamState.agents,
    events: base.streamState.events,
    fileProgress: base.streamState.fileProgress,
    error: base.streamState.error,
    isConfigured,
    provider,
    model,
    isNoDiffError: base.isNoDiffError,
    isCheckingForChanges: base.isCheckingForChanges,
    loadingMessage: base.loadingMessage,
  };

  return { state, start, goToSummary, goToResults, reset };
}
