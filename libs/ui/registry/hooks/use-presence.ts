"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type AnimationEvent,
  type RefObject,
} from "react";

type Phase = "hidden" | "open" | "closing";

export interface UsePresenceOptions {
  /** Whether the element should be visible. Flipping to false triggers the closing phase; the element stays mounted until the exit animation completes or `exitFallbackMs` fires. */
  open: boolean;
  /** Ref to the animated element. When provided, the hook attaches its own native animationend/animationcancel listeners and filters bubbling events from descendants. */
  ref?: RefObject<HTMLElement | null>;
  /** Max ms to wait for `animationend` before forcing the closing→hidden transition. Raise to at least 2× the exit-animation duration when customizing tokens past ~500ms. */
  exitFallbackMs?: number;
  /** Fired after the exit animation resolves (or the fallback timer fires) and the element transitions to hidden. */
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
  const [prevOpen, setPrevOpen] = useState(open);
  // Pinned exit animation-name filters the stray animationcancel that fires
  // when CSS swaps the enter keyframe for the exit keyframe mid-transition.
  const exitAnimationNameRef = useRef<string | null>(null);
  // useEffectEvent keeps onExitComplete fresh inside the effect-owned native
  // listener and fallback timer without putting it in effect deps (which would
  // re-subscribe / restart the timer on identity change).
  const notifyExit = useEffectEvent(() => {
    onExitComplete?.();
  });

  // Storing information from previous renders (React docs pattern): adjust
  // phase synchronously when `open` flips, skipping the stale commit an effect
  // would cause.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setPhase((current) => {
      if (open) return "open";
      return current === "open" ? "closing" : current;
    });
  }

  function commitExit() {
    if (phase !== "closing") return;
    setPhase("hidden");
    onExitComplete?.();
  }

  function onAnimationEnd(e: AnimationEvent) {
    if (ref && e.target !== ref.current) return;
    const expected = exitAnimationNameRef.current;
    if (expected && e.animationName !== expected) return;
    commitExit();
  }

  function onAnimationCancel(e: AnimationEvent) {
    if (ref && e.target !== ref.current) return;
    const expected = exitAnimationNameRef.current;
    if (expected && e.animationName !== expected) return;
    commitExit();
  }

  useEffect(() => {
    const element = ref?.current;
    if (!element || phase !== "closing") {
      exitAnimationNameRef.current = null;
      return;
    }
    const resolved = getComputedStyle(element).animationName;
    exitAnimationNameRef.current = resolved && resolved !== "none" ? resolved : null;
    // Native listener: React 19 does not register onAnimationCancel, and
    // testing-library's fireEvent.animationEnd on portaled descendants does
    // not reach React's delegated listener — so animation-driven unmount
    // must come from the DOM, not from React's synthetic event system.
    const handleAnimation = (event: globalThis.AnimationEvent) => {
      if (event.target !== element) return;
      const expected = exitAnimationNameRef.current;
      if (expected && event.animationName !== expected) return;
      setPhase((current) => (current === "closing" ? "hidden" : current));
      notifyExit();
    };
    element.addEventListener("animationend", handleAnimation);
    element.addEventListener("animationcancel", handleAnimation);
    return () => {
      element.removeEventListener("animationend", handleAnimation);
      element.removeEventListener("animationcancel", handleAnimation);
    };
  }, [phase, ref]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => {
      setPhase((current) => (current === "closing" ? "hidden" : current));
      notifyExit();
    }, exitFallbackMs);
    return () => clearTimeout(timer);
  }, [exitFallbackMs, phase]);

  return { present: phase !== "hidden", exiting: phase === "closing", onAnimationEnd, onAnimationCancel } as const;
}
