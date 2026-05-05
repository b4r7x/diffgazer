import type { SeverityCounts } from '@diffgazer/core/schemas/ui';
import { SEVERITY_ORDER, SEVERITY_LABELS } from '@diffgazer/core/schemas/ui';
import { SeverityBar } from './severity-bar';
import { cn } from '@diffgazer/core/cn';

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  className?: string;
}

export function SeverityBreakdown({ counts, className }: SeverityBreakdownProps) {
  const total = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0) || 1;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {SEVERITY_ORDER.map((severity) => (
        <SeverityBar
          key={severity}
          label={SEVERITY_LABELS[severity]}
          count={counts[severity]}
          max={total}
          severity={severity}
        />
      ))}
    </div>
  );
}
