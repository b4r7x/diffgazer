import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBar } from "./bar";

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  className?: string;
}

export function SeverityBreakdown({ counts, className }: SeverityBreakdownProps) {
  const total = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0) || 1;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
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
