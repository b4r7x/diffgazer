"use client";

import { useCallback, useEffect, useState, type AnimationEvent, type RefObject } from "react";

type Phase = "hidden" | "open" | "closing";

export interface UsePresenceOptions {
  open: boolean;
  ref?: RefObject<HTMLElement | null>;
  exitFallbackMs?: number;
  onExitComplete?: () => void;
}

const DEFAULT_EXIT_FALLBACK_MS = 250;

export function usePresence({
  open,
  ref,
  exitFallbackMs = DEFAULT_EXIT_FALLBACK_MS,
  onExitComplete,
}: UsePresenceOptions) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "hidden");

  // Intentional "adjust state during render" pattern supported by React 19:
  // synchronously sync phase with the `open` prop before commit.
  if (open && phase !== "open") {
    setPhase("open");
  }

  if (!open && phase === "open") {
    setPhase("closing");
  }

  const finishExit = useCallback(() => {
    if (phase === "closing") {
      setPhase("hidden");
      onExitComplete?.();
    }
  }, [onExitComplete, phase]);

  const onAnimationEnd = useCallback((e: AnimationEvent) => {
    if (ref && e.target !== ref.current) return;
    finishExit();
  }, [finishExit, ref]);

  const onAnimationCancel = useCallback((e: AnimationEvent) => {
    if (ref && e.target !== ref.current) return;
    finishExit();
  }, [finishExit, ref]);

  useEffect(() => {
    const element = ref?.current;
    if (!element || phase !== "closing") return;
    const handleAnimationCancel = (event: globalThis.AnimationEvent) => {
      if (event.target !== element) return;
      finishExit();
    };
    element.addEventListener("animationcancel", handleAnimationCancel);
    return () => element.removeEventListener("animationcancel", handleAnimationCancel);
  }, [finishExit, phase, ref]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(finishExit, exitFallbackMs);
    return () => clearTimeout(timer);
  }, [exitFallbackMs, finishExit, phase]);

  return { present: phase !== "hidden", exiting: phase === "closing", onAnimationEnd, onAnimationCancel } as const;
}
