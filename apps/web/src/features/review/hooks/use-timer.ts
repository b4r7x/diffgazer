import { useEffect, useState } from "react";

export interface UseTimerOptions {
  startTime?: Date;
  running?: boolean;
}

export interface UseTimerResult {
  elapsed: number;
}

export function useTimer({ startTime, running = false }: UseTimerOptions = {}): UseTimerResult {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || !startTime) {
      return;
    }

    const updateElapsed = () => {
      setElapsed(Date.now() - startTime.getTime());
    };
    updateElapsed();

    const interval = setInterval(updateElapsed, 100);

    return () => clearInterval(interval);
  }, [running, startTime]);

  return { elapsed };
}
