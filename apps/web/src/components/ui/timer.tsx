'use client';

import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export interface TimerProps {
  startTime?: Date;
  elapsedMs?: number;
  running?: boolean;
  format?: 'short' | 'long';
  className?: string;
}

function formatTime(ms: number, format: 'short' | 'long'): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (format === 'long') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function Timer({
  startTime,
  elapsedMs = 0,
  running = false,
  format = 'short',
  className,
}: TimerProps) {
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

  return (
    <span className={cn('text-tui-blue font-mono', className)}>
      {formatTime(elapsed, format)}
    </span>
  );
}
