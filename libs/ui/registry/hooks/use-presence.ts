"use client";

import {
  type AnimationEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

type Phase = "hidden" | "open" | "closing";

/** Options for mounting through enter/exit animation phases. */
export interface UsePresenceOptions {
  /** Whether the element should be visible. Flipping to false triggers the closing phase; the element stays mounted until the exit animation completes or `exitFallbackMs` fires. */
  open: boolean;
  /** Ref to the animated element. When provided, the hook attaches its own native animationend/animationcancel listeners and filters bubbling events from descendants. */
  ref?: RefObject<HTMLElement | null>;
  /** Max ms to wait for `animationend` before forcing the closing→hidden transition. Exit animations longer than this value are truncated. */
  exitFallbackMs?: number;
  /** Fired after the exit animation resolves (or the fallback timer fires) and the element transitions to hidden. */
  onExitComplete?: () => void;
}

const DEFAULT_EXIT_FALLBACK_MS = 250;

/** Keeps an element mounted while its exit animation completes. */
export function usePresence({
  open,
  ref,
  exitFallbackMs = DEFAULT_EXIT_FALLBACK_MS,
  onExitComplete,
}: UsePresenceOptions) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "hidden");
  const [prevOpen, setPrevOpen] = useState(open);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const exitCompletedRef = useRef(false);
  // Pinned exit names filter the stray animationcancel fired when CSS swaps enter→exit keyframes.
  const exitAnimationNamesRef = useRef<readonly string[]>([]);
  const completeExitFromEffect = useEffectEvent(() => {
    if (phaseRef.current !== "closing" || exitCompletedRef.current) return;
    exitCompletedRef.current = true;
    setPhase("hidden");
    onExitComplete?.();
  });

  // Adjust phase during render (React's store-prev-render pattern), not in an effect that stale-commits.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open || phase === "open") exitCompletedRef.current = false;
    setPhase((current) => {
      if (open) return "open";
      return current === "open" ? "closing" : current;
    });
  }

  function commitExit() {
    if (phaseRef.current !== "closing" || exitCompletedRef.current) return;
    exitCompletedRef.current = true;
    setPhase("hidden");
    onExitComplete?.();
  }

  function matchesExitAnimation(animationName: string) {
    const expected = exitAnimationNamesRef.current;
    return expected.length === 0 || expected.includes(animationName);
  }

  function onAnimationEnd(e: AnimationEvent) {
    if (ref) return; // native listener handles it
    if (e.target !== e.currentTarget) return; // ignore animations bubbling from descendants
    if (!matchesExitAnimation(e.animationName)) return;
    commitExit();
  }

  useEffect(() => {
    const element = ref?.current;
    if (!element || phase !== "closing") {
      exitAnimationNamesRef.current = [];
      return;
    }
    const animationNames = getComputedStyle(element)
      .animationName.split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && name !== "none");
    exitAnimationNamesRef.current = animationNames;
    if (animationNames.length === 0) {
      completeExitFromEffect();
      return;
    }
    // React 19 doesn't expose animationcancel via synthetic props, and fireEvent doesn't reach
    // portaled descendants — drive animation-based unmount from the DOM, not synthetic events.
    const handleAnimation = (event: globalThis.AnimationEvent) => {
      if (event.target !== element) return;
      const expected = exitAnimationNamesRef.current;
      if (expected.length > 0 && !expected.includes(event.animationName)) return;
      completeExitFromEffect();
    };
    element.addEventListener("animationend", handleAnimation);
    element.addEventListener("animationcancel", handleAnimation);
    return () => {
      element.removeEventListener("animationend", handleAnimation);
      element.removeEventListener("animationcancel", handleAnimation);
    };
  }, [phase, ref]);

  useEffect(() => {
    if (phase !== "closing" || exitCompletedRef.current) return;
    const timer = setTimeout(() => {
      completeExitFromEffect();
    }, exitFallbackMs);
    return () => clearTimeout(timer);
  }, [exitFallbackMs, phase]);

  return {
    present: phase !== "hidden",
    exiting: phase === "closing",
    onAnimationEnd,
  } as const;
}
