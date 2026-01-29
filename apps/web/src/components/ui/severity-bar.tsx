import { cn } from '../../lib/utils';

export type SeverityLevel = 'blocker' | 'high' | 'medium' | 'low';

export interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: SeverityLevel;
  className?: string;
}

const SEVERITY_COLORS: Record<SeverityLevel, { bar: string; count: string }> = {
  blocker: { bar: 'text-tui-red', count: 'text-tui-red' },
  high: { bar: 'text-tui-yellow', count: 'text-tui-yellow' },
  medium: { bar: 'text-gray-400', count: 'text-gray-400' },
  low: { bar: 'text-tui-blue', count: 'text-tui-blue' },
};

const FILLED_CHAR = '█';
const EMPTY_CHAR = '░';
const BAR_WIDTH = 20;

export function SeverityBar({ label, count, max, severity, className }: SeverityBarProps) {
  const colors = SEVERITY_COLORS[severity];
  const filled = max > 0 ? Math.round((count / max) * BAR_WIDTH) : 0;
  const empty = BAR_WIDTH - filled;

  return (
    <div className={cn('flex items-center font-mono text-sm', className)}>
      <span className="w-20 text-xs text-gray-500">{label}</span>
      <div className="flex-1 flex items-center tracking-widest">
        <span className={colors.bar}>{FILLED_CHAR.repeat(filled)}</span>
        <span className="text-gray-700">{EMPTY_CHAR.repeat(empty)}</span>
      </div>
      <span className={cn('w-6 text-right font-bold', colors.count)}>{count}</span>
    </div>
  );
}
