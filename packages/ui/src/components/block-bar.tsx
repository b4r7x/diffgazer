import { cn } from "../lib/cn";

/** Unicode filled block */
const DEFAULT_FILLED_CHAR = "\u2588";
/** Unicode light shade */
const DEFAULT_EMPTY_CHAR = "\u2591";
const DEFAULT_BAR_WIDTH = 20;

export interface BlockBarProps {
  label: string;
  count: number;
  max: number;
  color: string;
  barWidth?: number;
  filledChar?: string;
  emptyChar?: string;
  className?: string;
}

export function BlockBar({
  label,
  count,
  max,
  color,
  barWidth = DEFAULT_BAR_WIDTH,
  filledChar = DEFAULT_FILLED_CHAR,
  emptyChar = DEFAULT_EMPTY_CHAR,
  className,
}: BlockBarProps) {
  const filled = max > 0 ? Math.round((count / max) * barWidth) : 0;
  const empty = barWidth - filled;

  return (
    <div className={cn("flex items-center font-mono text-sm", className)} aria-label={`${label}: ${count}`}>
      <span className="w-20 text-xs text-tui-muted">{label}</span>
      <div className="flex-1 flex items-center tracking-widest">
        <span className={color}>{filledChar.repeat(filled)}</span>
        <span className="text-tui-border">{emptyChar.repeat(empty)}</span>
      </div>
      <span className={cn("w-6 text-right font-bold", color)}>{count}</span>
    </div>
  );
}
