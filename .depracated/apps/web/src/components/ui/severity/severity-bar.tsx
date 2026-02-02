import { cn } from '../../../lib/utils';
import type { TriageSeverity } from '@repo/schemas/triage';
import { BAR_FILLED_CHAR, BAR_EMPTY_CHAR, DEFAULT_BAR_WIDTH, SEVERITY_CONFIG } from '@repo/schemas/ui';

export interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: TriageSeverity;
  className?: string;
}

export function SeverityBar({ label, count, max, severity, className }: SeverityBarProps) {
  const { color } = SEVERITY_CONFIG[severity];
  const filled = max > 0 ? Math.round((count / max) * DEFAULT_BAR_WIDTH) : 0;
  const empty = DEFAULT_BAR_WIDTH - filled;

  return (
    <div className={cn('flex items-center font-mono text-sm', className)}>
      <span className="w-20 text-xs text-gray-500">{label}</span>
      <div className="flex-1 flex items-center tracking-widest">
        <span className={color}>{BAR_FILLED_CHAR.repeat(filled)}</span>
        <span className="text-gray-800">{BAR_EMPTY_CHAR.repeat(empty)}</span>
      </div>
      <span className={cn('w-6 text-right font-bold', color)}>{count}</span>
    </div>
  );
}
