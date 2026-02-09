import { formatTime } from '@diffgazer/core/format';
import { useTimer } from '@diffgazer/hooks';
import { cn } from '@/utils/cn';

export interface TimerProps {
  startTime?: Date;
  elapsedMs?: number;
  running?: boolean;
  format?: 'short' | 'long';
  className?: string;
}

export function Timer({
  startTime,
  elapsedMs = 0,
  running = false,
  format = 'short',
  className,
}: TimerProps) {
  const { elapsed } = useTimer({ startTime, elapsedMs, running });

  return (
    <span className={cn('text-tui-blue font-mono', className)}>
      {formatTime(elapsed, format)}
    </span>
  );
}
