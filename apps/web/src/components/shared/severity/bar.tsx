import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { BlockBar } from "@diffgazer/ui/components/block-bar";
import { cn } from "@diffgazer/ui/lib/utils";
import { SEVERITY_CONFIG } from "./constants";

interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: ReviewSeverity;
  className?: string;
}

export function SeverityBar({ label, count, max, severity, className }: SeverityBarProps) {
  const { color } = SEVERITY_CONFIG[severity];

  return (
    <div className={cn("flex items-center font-mono text-sm", className)}>
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <BlockBar
        label={label}
        value={count}
        max={max}
        valueText={`${label}: ${count}`}
        className="flex-1"
      >
        <BlockBar.Segment value={count} className={color} />
      </BlockBar>
      <span className={cn("w-6 text-right font-bold", count > 0 ? color : "text-muted-foreground")}>
        {count}
      </span>
    </div>
  );
}
