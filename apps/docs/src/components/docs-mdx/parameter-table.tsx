import { cn } from "@diffgazer/ui/lib/utils";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";

interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string | null;
  description?: string;
}

const GRID_COLS =
  "md:grid-cols-[minmax(9ch,auto)_fit-content(30ch)_minmax(6ch,auto)_minmax(0,1fr)]";

const ROW_SUBGRID = "md:grid md:grid-cols-subgrid md:col-span-full md:gap-x-4";

const badgeClass =
  "px-1.5 py-0.5 border border-border text-2xs text-muted-foreground rounded bg-background font-mono";

export function ParameterTable({ params }: { params: Parameter[] }) {
  return (
    <div className={cn("text-sm md:grid md:gap-x-4", GRID_COLS)}>
      <div className={cn("hidden border-b border-border/60 pb-2", ROW_SUBGRID)}>
        <span className={CHROME_LABEL_CLASS}>Prop</span>
        <span className={CHROME_LABEL_CLASS}>Type</span>
        <span className={CHROME_LABEL_CLASS}>Default</span>
        <span className={CHROME_LABEL_CLASS}>Description</span>
      </div>
      {params.map((param) => (
        <div
          key={param.name}
          className={cn(
            "grid gap-y-2 border-b border-border/60 py-2.5 last:border-b-0 md:items-baseline md:gap-y-0",
            ROW_SUBGRID,
          )}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 md:contents">
            <span className="flex items-center gap-2 break-words font-bold text-foreground">
              {param.name}
              {param.required && <span className={badgeClass}>required</span>}
            </span>
            <span className="min-w-0 break-words font-mono text-xs text-info">{param.type}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 md:contents">
            <span
              className={cn(
                "min-w-0 break-words font-mono text-xs tabular-nums text-muted-foreground",
                param.defaultValue == null && "hidden md:block",
              )}
            >
              {param.defaultValue ?? "—"}
            </span>
            {param.description && (
              <span className="min-w-0 break-words text-muted-foreground">{param.description}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
