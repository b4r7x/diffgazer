"use client";

import { useState, useEffectEvent, type AnimationEvent, type RefObject } from "react";

type Phase = "hidden" | "open" | "closing";

export interface UsePresenceOptions {
  open: boolean;
  ref?: RefObject<HTMLElement | null>;
}

export function usePresence({ open, ref }: UsePresenceOptions) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "hidden");

  // Intentional "adjust state during render" pattern supported by React 19:
  // synchronously sync phase with the `open` prop before commit.
  if (open && phase !== "open") {
    setPhase("open");
  }

  if (!open && phase === "open") {
    setPhase("closing");
  }

  const onAnimationEnd = useEffectEvent((e: AnimationEvent) => {
    if (ref && e.target !== ref.current) return;
    if (phase === "closing") {
      setPhase("hidden");
    }
  });

  return { present: phase !== "hidden", exiting: phase === "closing", onAnimationEnd } as const;
}
