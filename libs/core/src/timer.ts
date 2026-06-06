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

    const updateElapsed = () => {
      setElapsed(Date.now() - startTime.getTime() + elapsedMs);
    };
    updateElapsed();

    const interval = setInterval(updateElapsed, 100);

    return () => clearInterval(interval);
  }, [running, startTime, elapsedMs]);

  return { elapsed: running ? elapsed : elapsedMs };
}
