import { useEffect, useState } from "react";

export interface UseTimerOptions {
  startTime?: Date;
  elapsedMs?: number;
  running?: boolean;
}

export interface UseTimerResult {
  elapsed: number;
}

/**
 * Hook for tracking elapsed time with interval updates.
 * Returns elapsed milliseconds since startTime (plus any initial elapsedMs offset).
 */
export function useTimer({
  startTime,
  elapsedMs = 0,
  running = false,
}: UseTimerOptions = {}): UseTimerResult {
  const [elapsed, setElapsed] = useState(elapsedMs);

  useEffect(() => {
    if (!running || !startTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime() + elapsedMs);
    }, 100);

    return () => clearInterval(interval);
  }, [running, startTime, elapsedMs]);

  // Sync elapsedMs prop when not running
  useEffect(() => {
    if (!running) {
      setElapsed(elapsedMs);
    }
  }, [elapsedMs, running]);

  return { elapsed };
}
