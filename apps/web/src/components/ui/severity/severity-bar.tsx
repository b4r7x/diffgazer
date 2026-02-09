import { cn } from '@/utils/cn';
import type { ReviewSeverity } from '@diffgazer/schemas/review';
import { BAR_FILLED_CHAR, BAR_EMPTY_CHAR, DEFAULT_BAR_WIDTH, SEVERITY_CONFIG } from './constants';

export interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: ReviewSeverity;
  className?: string;
}

export function SeverityBar({ label, count, max, severity, className }: SeverityBarProps) {
  const { color } = SEVERITY_CONFIG[severity];
  const filled = max > 0 ? Math.round((count / max) * DEFAULT_BAR_WIDTH) : 0;
  const empty = DEFAULT_BAR_WIDTH - filled;

  return (
    <div className={cn('flex items-center font-mono text-sm', className)} aria-label={`${label}: ${count}`}>
      <span className="w-20 text-xs text-tui-muted">{label}</span>
      <div className="flex-1 flex items-center tracking-widest">
        <span className={color}>{BAR_FILLED_CHAR.repeat(filled)}</span>
        <span className="text-tui-border">{BAR_EMPTY_CHAR.repeat(empty)}</span>
      </div>
      <span className={cn('w-6 text-right font-bold', color)}>{count}</span>
    </div>
  );
}
