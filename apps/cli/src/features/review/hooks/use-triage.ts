import { useState, useCallback, useRef } from "react";
import { type TriageResult, type TriageError } from "@repo/schemas/triage";
import {
  type FullTriageStreamEvent,
  FullTriageStreamEventSchema,
} from "@repo/schemas";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { StepState } from "@repo/schemas/step-event";
import { isStepEvent } from "@repo/schemas/step-event";
import { getErrorMessage, isAbortError, truncateToDisplayLength } from "@repo/core";
import { createErrorState } from "../../../lib/state-helpers.js";
import {
  triageReducer,
  createInitialTriageState,
  type TriageState as CoreTriageState,
} from "@repo/core/review";
import { useSSEStream, type SSEStreamError } from "../../../hooks/use-sse-stream.js";
import { streamTriage } from "../api/index.js";

const MAX_DISPLAY_LENGTH = 50_000;

export interface LensProgress {
  currentLens: string | null;
  currentIndex: number;
  totalLenses: number;
  completedLenses: string[];
}

export type TriageState =
  | { status: "idle" }
  | { status: "loading"; content: string; lensProgress: LensProgress; agentEvents: AgentStreamEvent[]; steps: StepState[] }
  | { status: "success"; data: TriageResult; lensProgress: LensProgress; reviewId: string; agentEvents: AgentStreamEvent[]; steps: StepState[] }
  | { status: "error"; error: TriageError };

const initialLensProgress: LensProgress = {
  currentLens: null,
  currentIndex: 0,
  totalLenses: 0,
  completedLenses: [],
};

const AGENT_EVENT_TYPES = [
  "agent_start",
  "agent_thinking",
  "tool_call",
  "tool_result",
  "issue_found",
  "agent_complete",
  "orchestrator_complete",
] as const;

function isAgentEvent(event: FullTriageStreamEvent): event is AgentStreamEvent {
  return AGENT_EVENT_TYPES.includes(event.type as (typeof AGENT_EVENT_TYPES)[number]);
}

export interface UseTriageOptions {
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
}

export function useTriage(options: UseTriageOptions = {}) {
  const [state, setState] = useState<TriageState>({ status: "idle" });
  const streamedContentRef = useRef("");
  const lensProgressRef = useRef<LensProgress>(initialLensProgress);
  const agentEventsRef = useRef<AgentStreamEvent[]>([]);
  const coreStateRef = useRef<CoreTriageState>(createInitialTriageState());

  const handleEvent = useCallback((event: FullTriageStreamEvent): boolean => {
    // Dispatch step and agent events to core reducer
    if (isStepEvent(event) || isAgentEvent(event)) {
      coreStateRef.current = triageReducer(coreStateRef.current, { type: "EVENT", event });
    }

    if (isAgentEvent(event)) {
      agentEventsRef.current = [...agentEventsRef.current, event];
      setState((prev) => {
        if (prev.status === "loading") {
          return { ...prev, agentEvents: agentEventsRef.current, steps: coreStateRef.current.steps };
        }
        return prev;
      });
    }

    if (isStepEvent(event)) {
      setState((prev) => {
        if (prev.status === "loading") {
          return { ...prev, steps: coreStateRef.current.steps };
        }
        return prev;
      });
      return false;
    }

    if (event.type === "chunk") {
      streamedContentRef.current = truncateToDisplayLength(
        streamedContentRef.current,
        event.content,
        MAX_DISPLAY_LENGTH
      );
      setState({
        status: "loading",
        content: streamedContentRef.current,
        lensProgress: lensProgressRef.current,
        agentEvents: agentEventsRef.current,
        steps: coreStateRef.current.steps,
      });
      return false;
    }

    if (event.type === "lens_start") {
      lensProgressRef.current = {
        ...lensProgressRef.current,
        currentLens: event.lens,
        currentIndex: event.index,
        totalLenses: event.total,
      };
      setState({
        status: "loading",
        content: streamedContentRef.current,
        lensProgress: lensProgressRef.current,
        agentEvents: agentEventsRef.current,
        steps: coreStateRef.current.steps,
      });
      return false;
    }

    if (event.type === "lens_complete") {
      lensProgressRef.current = {
        ...lensProgressRef.current,
        completedLenses: [...lensProgressRef.current.completedLenses, event.lens],
      };
      setState({
        status: "loading",
        content: streamedContentRef.current,
        lensProgress: lensProgressRef.current,
        agentEvents: agentEventsRef.current,
        steps: coreStateRef.current.steps,
      });
      return false;
    }

    if (event.type === "complete") {
      coreStateRef.current = triageReducer(coreStateRef.current, { type: "COMPLETE" });
      setState({
        status: "success",
        data: event.result,
        lensProgress: lensProgressRef.current,
        reviewId: event.reviewId,
        agentEvents: agentEventsRef.current,
        steps: coreStateRef.current.steps,
      });
      return true;
    }

    if (event.type === "error") {
      coreStateRef.current = triageReducer(coreStateRef.current, { type: "ERROR", error: event.error.message });
      setState({ status: "error", error: event.error });
      return true;
    }

    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setState(createErrorState(error.message));
  }, []);

  const { processStream, resetController, abort } = useSSEStream({
    schema: FullTriageStreamEventSchema,
    onEvent: handleEvent,
    onError: handleError,
  });

  async function startTriage(staged = true): Promise<void> {
    const controller = resetController();
    streamedContentRef.current = "";
    lensProgressRef.current = initialLensProgress;
    agentEventsRef.current = [];
    coreStateRef.current = triageReducer(createInitialTriageState(), { type: "START" });
    setState({ status: "loading", content: "", lensProgress: initialLensProgress, agentEvents: [], steps: coreStateRef.current.steps });

    try {
      const res = await streamTriage({
        mode: staged ? "staged" : "unstaged",
        files: options.files,
        lenses: options.lenses,
        profile: options.profile,
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) {
        setState(createErrorState("No response body"));
        return;
      }

      await processStream(reader);
    } catch (error) {
      if (!isAbortError(error)) {
        setState(createErrorState(getErrorMessage(error)));
      }
    }
  }

  function reset(): void {
    abort();
    coreStateRef.current = triageReducer(coreStateRef.current, { type: "RESET" });
    setState({ status: "idle" });
  }

  const agentEvents = state.status === "loading" || state.status === "success"
    ? state.agentEvents
    : [];

  return { state, startTriage, reset, agentEvents };
}
