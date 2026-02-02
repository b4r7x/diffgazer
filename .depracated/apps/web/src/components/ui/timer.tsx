'use client';

import { formatTime } from '@repo/core';
import { useTimer } from '@repo/hooks';
import { cn } from '../../lib/utils';

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
