import { cn } from '@diffgazer/ui/lib/utils';
import type { ReviewSeverity } from '@diffgazer/core/schemas/review';
import { BlockBar } from '@diffgazer/ui/components/block-bar';
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

  return (
    <div className={cn('flex items-center font-mono text-sm', className)}>
      <span className="w-20 text-xs text-tui-muted">{label}</span>
      <BlockBar
        label={label}
        value={count}
        max={max}
        barWidth={DEFAULT_BAR_WIDTH}
        filledChar={BAR_FILLED_CHAR}
        emptyChar={BAR_EMPTY_CHAR}
        valueText={`${label}: ${count}`}
        className="flex-1"
      >
        <BlockBar.Segment value={count} className={color} />
      </BlockBar>
      <span className={cn('w-6 text-right font-bold', color)}>{count}</span>
    </div>
  );
}
