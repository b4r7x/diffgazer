import { useEffect, useState } from "react";

export interface UseTimerOptions {
  startTime?: Date;
  elapsedMs?: number;
  running?: boolean;
}

export interface UseTimerResult {
  elapsed: number;
}

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

  useEffect(() => {
    if (!running) {
      setElapsed(elapsedMs);
    }
  }, [elapsedMs, running]);

  return { elapsed };
}
