import { buildSeverityBreakdownRows } from "@diffgazer/core/review";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
import { cn } from "@diffgazer/ui/lib/utils";
import { SeverityBar } from "./bar";

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  className?: string;
}

export function SeverityBreakdown({ counts, className }: SeverityBreakdownProps) {
  const rows = buildSeverityBreakdownRows(counts);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {rows.map((row) => (
        <SeverityBar
          key={row.severity}
          label={row.label}
          count={row.count}
          max={row.total}
          severity={row.severity}
        />
      ))}
    </div>
  );
}
