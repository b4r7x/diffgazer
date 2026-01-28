'use client';

import { cn } from '../../lib/utils';

interface WizardProgressProps {
  current: number;
  total: number;
  className?: string;
}

export function WizardProgress({ current, total, className }: WizardProgressProps) {
  return (
    <div className={cn('flex gap-1.5 items-center', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'text-sm',
            i < current ? 'text-[--tui-fg]' : 'text-[--tui-fg-muted]'
          )}
        >
          {i < current ? '●' : '○'}
        </span>
      ))}
    </div>
  );
}
