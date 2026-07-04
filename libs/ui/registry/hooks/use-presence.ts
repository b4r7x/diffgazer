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
  // Pinned exit animation names filter the stray animationcancel that fires
  // when CSS swaps the enter keyframe for the exit keyframe mid-transition.
  const exitAnimationNamesRef = useRef<readonly string[]>([]);
  const completeExitFromEffect = useEffectEvent(() => {
    if (phaseRef.current !== "closing" || exitCompletedRef.current) return;
    exitCompletedRef.current = true;
    setPhase("hidden");
    onExitComplete?.();
  });

  // Storing information from previous renders (React docs pattern): adjust
  // phase synchronously when `open` flips, skipping the stale commit an effect
  // would cause.
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
    // Native listener: React 19 does not expose animation cancellation through
    // synthetic event props, and
    // testing-library's fireEvent.animationEnd on portaled descendants does
    // not reach React's delegated listener — so animation-driven unmount
    // must come from the DOM, not from React's synthetic event system.
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
