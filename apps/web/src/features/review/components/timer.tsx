import { formatTime } from "@diffgazer/core/format";
import { useTimer } from "../hooks/use-timer";

export interface TimerProps {
  startTime?: Date;
  running?: boolean;
}

export function Timer({ startTime, running = false }: TimerProps) {
  const { elapsed } = useTimer({ startTime, running });

  return <span className="text-info-text font-mono">{formatTime(elapsed)}</span>;
}
