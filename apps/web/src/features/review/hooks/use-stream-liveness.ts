import type { LogStreamState, ReviewEvent } from "@diffgazer/core/review";
import { useEffect, useState } from "react";

/** Silence after which the run calls the stream quiet. */
const QUIET_AFTER_MS = 20_000;
/** Silence after which the run calls the stream dead and offers to reconnect. */
const STALLED_AFTER_MS = 45_000;

export interface StreamLiveness {
  state: LogStreamState;
  /** Epoch ms of the last observed event, for the leaves that print seconds. */
  lastEventAt: number;
}

/**
 * Derives how alive the event stream is from the time since the last event. The
 * SSE transport only reports an error when the connection breaks loudly; a
 * silently stalled stream produces nothing at all, which is why a frozen screen
 * is indistinguishable from a working one without this clock.
 */
export function useStreamLiveness({
  events,
  isRunning,
}: {
  events: readonly ReviewEvent[];
  isRunning: boolean;
}): StreamLiveness {
  const [seenEvents, setSeenEvents] = useState(events);
  const [lastEventAt, setLastEventAt] = useState(() => Date.now());
  const [state, setState] = useState<LogStreamState>("flowing");

  // Arrival is a change of array identity, never a longer array: the event
  // buffer is capped, so on a long run `events.length` stops growing while
  // events keep flowing, and a length check would call a live stream dead.
  if (seenEvents !== events) {
    setSeenEvents(events);
    setLastEventAt(Date.now());
    setState("flowing");
  }

  // Silence is the absence of renders, so only a timer can make it visible.
  // The two thresholds are scheduled rather than polled: this re-renders when
  // the state word changes, not once a second for the whole run.
  useEffect(() => {
    if (!isRunning) return;
    const silentForMs = Date.now() - lastEventAt;
    const quietTimer = setTimeout(
      () => setState("quiet"),
      Math.max(0, QUIET_AFTER_MS - silentForMs),
    );
    const stalledTimer = setTimeout(
      () => setState("stalled"),
      Math.max(0, STALLED_AFTER_MS - silentForMs),
    );
    return () => {
      clearTimeout(quietTimer);
      clearTimeout(stalledTimer);
    };
  }, [isRunning, lastEventAt]);

  return { state, lastEventAt };
}
