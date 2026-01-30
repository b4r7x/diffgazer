import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type TimerFormat = "short" | "long";

interface TimerProps {
  startTime?: Date;
  elapsedMs?: number;
  running?: boolean;
  format?: TimerFormat;
}

function formatTime(ms: number, format: TimerFormat): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (format === "long") {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function Timer({
  startTime,
  elapsedMs = 0,
  running = false,
  format = "short",
}: TimerProps): ReactElement {
  const { colors } = useTheme();
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

  return (
    <Text color={colors.ui.info}>{formatTime(elapsed, format)}</Text>
  );
}
