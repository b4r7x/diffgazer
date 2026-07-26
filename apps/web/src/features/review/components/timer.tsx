import { formatTime } from "@diffgazer/core/format";
import { useReviewClock } from "../hooks/use-review-clock";

export interface TimerProps {
  startTime?: Date;
}

export function Timer({ startTime }: TimerProps) {
  const now = useReviewClock();
  const elapsed = startTime ? Math.max(0, now - startTime.getTime()) : 0;

  return <span className="text-info-text font-mono">{formatTime(elapsed)}</span>;
}
