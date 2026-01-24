import { useState, useCallback, useRef } from "react";
import {
  type TriageResult,
  type TriageError,
  type TriageStreamEvent,
  TriageStreamEventSchema,
} from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { getErrorMessage, isAbortError, createErrorState, truncateToDisplayLength } from "@repo/core";
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
  | { status: "loading"; content: string; lensProgress: LensProgress }
  | { status: "success"; data: TriageResult; lensProgress: LensProgress; reviewId: string }
  | { status: "error"; error: TriageError };

const initialLensProgress: LensProgress = {
  currentLens: null,
  currentIndex: 0,
  totalLenses: 0,
  completedLenses: [],
};

export interface UseTriageOptions {
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
}

export function useTriage(options: UseTriageOptions = {}) {
  const [state, setState] = useState<TriageState>({ status: "idle" });
  const streamedContentRef = useRef("");
  const lensProgressRef = useRef<LensProgress>(initialLensProgress);

  const handleEvent = useCallback((event: TriageStreamEvent): boolean => {
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
      });
      return false;
    }

    if (event.type === "complete") {
      setState({
        status: "success",
        data: event.result,
        lensProgress: lensProgressRef.current,
        reviewId: event.reviewId,
      });
      return true;
    }

    if (event.type === "error") {
      setState({ status: "error", error: event.error });
      return true;
    }

    return false;
  }, []);

  const handleError = useCallback((error: SSEStreamError): void => {
    setState(createErrorState(error.message));
  }, []);

  const { processStream, resetController, abort } = useSSEStream({
    schema: TriageStreamEventSchema,
    onEvent: handleEvent,
    onError: handleError,
  });

  async function startTriage(staged = true): Promise<void> {
    const controller = resetController();
    streamedContentRef.current = "";
    lensProgressRef.current = initialLensProgress;
    setState({ status: "loading", content: "", lensProgress: initialLensProgress });

    try {
      const res = await streamTriage({
        staged,
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
    setState({ status: "idle" });
  }

  return { state, startTriage, reset };
}
