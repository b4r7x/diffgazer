import { useState } from "react";
import { useReviewStream, useApi, useInit, useSettings, useReviewStart, useReviewCompletion } from "@diffgazer/api/hooks";
import { resolveDefaultLenses, isNoDiffError as checkNoDiffError, isCheckingForChanges as checkForChanges, getLoadingMessage } from "@diffgazer/core/review";
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
  start: (mode: string) => void;
  goToSummary: () => void;
  goToResults: () => void;
  reset: () => void;
} {
  const api = useApi();
  const stream = useReviewStream();
  const { data: initData, isLoading: configLoading } = useInit();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [mode, setMode] = useState<ReviewMode>("staged");
  const [startToken, setStartToken] = useState(0);
  const [phase, setPhase] = useState<"streaming" | "summary" | "results">("streaming");

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;
  const defaultLenses = resolveDefaultLenses(settings?.defaultLenses);

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    mode,
    configLoading,
    settingsLoading,
    isConfigured,
    startToken,
    defaultLenses,
    start: (options) => stream.start(options.mode!, options.lenses),
    resume: stream.resume,
    getActiveSession: api.getActiveReviewSession,
  });

  const { isCompleting, skipDelay, reset: resetCompletion } = useReviewCompletion({
    isStreaming: stream.state.isStreaming,
    error: stream.state.error,
    hasStreamed,
    steps: stream.state.steps,
    onComplete: () => setPhase("summary"),
  });

  const isNoDiffError = checkNoDiffError(stream.state.error);
  const isCheckingForChanges = checkForChanges(stream.state.isStreaming, stream.state.steps);
  const isInitializing = !hasStarted && isConfigured && !configLoading;

  const loadingMessage = getLoadingMessage({
    configLoading,
    settingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  const displayPhase: ReviewLifecycleState["phase"] =
    !hasStarted ? "loading" : isCompleting ? "completing" : phase;

  function start(rawMode: string) {
    const resolvedMode = (rawMode === "unstaged" || rawMode === "files" ? rawMode : "staged") as ReviewMode;
    setMode(resolvedMode);
    setHasStarted(false);
    setStartToken((t) => t + 1);
  }

  function goToSummary() {
    skipDelay();
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
    resetCompletion();
    setHasStarted(false);
    setHasStreamed(false);
    setPhase("streaming");
    stream.abort();
  }

  const durationMs =
    stream.state.startedAt
      ? Date.now() - stream.state.startedAt.getTime()
      : undefined;

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    reviewId: stream.state.reviewId ?? null,
    durationMs,
    issues: stream.state.issues,
    steps: stream.state.steps,
    agents: stream.state.agents,
    events: stream.state.events,
    fileProgress: stream.state.fileProgress,
    error: stream.state.error,
    isConfigured,
    provider,
    model,
    isNoDiffError,
    isCheckingForChanges,
    loadingMessage,
  };

  return { state, start, goToSummary, goToResults, reset };
}
