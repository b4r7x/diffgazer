import { useState, useEffect, useRef } from "react";
import { useReviewStream, useInit, useSettings, useActiveReviewSession } from "@diffgazer/api/hooks";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/schemas/review";
import { LensIdSchema, type LensId } from "@diffgazer/schemas/review";
import type { StepState, AgentState } from "@diffgazer/schemas/events";
import type { ReviewEvent, FileProgress } from "@diffgazer/core/review";

export type ReviewPhase =
  | "idle"
  | "checking-config"
  | "checking-changes"
  | "streaming"
  | "completing"
  | "summary"
  | "results";

export interface ReviewLifecycleState {
  phase: ReviewPhase;
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

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];
const COMPLETION_DELAY_MS = 2300;

function resolveDefaultLenses(rawLenses: string[] | undefined): LensId[] {
  const parsed =
    rawLenses?.filter(
      (lens): lens is LensId => LensIdSchema.safeParse(lens).success,
    ) ?? [];
  return parsed.length > 0 ? parsed : FALLBACK_LENSES;
}

export function useReviewLifecycle(): {
  state: ReviewLifecycleState;
  start: (mode: string) => void;
  goToSummary: () => void;
  goToResults: () => void;
  reset: () => void;
} {
  const [phase, setPhase] = useState<ReviewPhase>("idle");
  const stream = useReviewStream();
  const { data: initData, isLoading: configLoading } = useInit();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsStreamingRef = useRef(false);
  const [mode, setMode] = useState<ReviewMode>("staged");

  const {
    data: sessionData,
    isLoading: sessionLoading,
    error: sessionError,
  } = useActiveReviewSession(mode);

  const isConfigured = initData?.configured ?? false;
  const provider = initData?.config?.provider ?? null;
  const model = initData?.config?.model ?? null;
  const defaultLenses = resolveDefaultLenses(settings?.defaultLenses);

  // Derive error flags from stream state
  const isNoDiffError =
    stream.state.error?.includes("No staged changes") === true ||
    stream.state.error?.includes("No unstaged changes") === true;

  const diffStep = stream.state.steps.find((s) => s.id === "diff");
  const isCheckingForChanges =
    stream.state.isStreaming &&
    diffStep?.status !== "completed" &&
    diffStep?.status !== "error";

  const loadingMessage =
    configLoading || settingsLoading
      ? "Loading configuration..."
      : phase === "checking-config"
        ? "Checking provider configuration..."
        : phase === "checking-changes" || isCheckingForChanges
          ? "Checking for changes..."
          : null;

  function start(rawMode: string) {
    if (hasStartedRef.current) return;
    const resolvedMode = (rawMode === "unstaged" || rawMode === "files" ? rawMode : "staged") as ReviewMode;
    setMode(resolvedMode);
    hasStartedRef.current = true;
    setPhase("checking-config");
  }

  // Transition from checking-config to checking-changes once config is ready
  useEffect(() => {
    if (phase !== "checking-config") return;
    if (configLoading || settingsLoading) return;
    if (!isConfigured) return; // Stay here; UI shows "not configured" via state

    setPhase("checking-changes");
  }, [phase, configLoading, settingsLoading, isConfigured]);

  // Check for active session, then start or resume the stream
  useEffect(() => {
    if (phase !== "checking-changes") return;
    if (sessionLoading) return;

    let ignore = false;
    const lenses = defaultLenses;

    const startFresh = () => {
      if (ignore) return;
      setPhase("streaming");
      hasStreamedRef.current = true;
      void stream.start(mode, lenses);
    };

    const resumeById = (reviewId: string, onNotFound: () => void) => {
      if (ignore) return;
      setPhase("streaming");
      hasStreamedRef.current = true;
      void stream.resume(reviewId).then((result) => {
        if (ignore) return;
        if (result && !result.ok) {
          if (result.error.code === ReviewErrorCode.SESSION_STALE) {
            startFresh();
          } else if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
            onNotFound();
          }
        }
      });
    };

    if (sessionError) {
      startFresh();
    } else {
      const activeReviewId = sessionData?.session?.reviewId;
      if (!activeReviewId) {
        startFresh();
      } else {
        resumeById(activeReviewId, startFresh);
      }
    }

    return () => {
      ignore = true;
    };
  }, [phase, sessionLoading, sessionData, sessionError]);

  // Detect stream completion and transition to completing -> summary
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = stream.state.isStreaming;

    if (
      wasStreaming &&
      !stream.state.isStreaming &&
      hasStreamedRef.current &&
      !stream.state.error
    ) {
      setPhase("completing");

      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        setPhase("summary");
      }, COMPLETION_DELAY_MS);
    }

    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [stream.state.isStreaming, stream.state.error]);

  function goToSummary() {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setPhase("summary");
  }

  function goToResults() {
    setPhase("results");
  }

  function reset() {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    hasStartedRef.current = false;
    hasStreamedRef.current = false;
    prevIsStreamingRef.current = false;
    setPhase("idle");
    stream.abort();
  }

  const durationMs =
    stream.state.startedAt
      ? Date.now() - stream.state.startedAt.getTime()
      : undefined;

  const state: ReviewLifecycleState = {
    phase,
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
