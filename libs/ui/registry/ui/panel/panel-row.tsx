import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for panel row. */
export interface PanelRowProps extends Omit<ComponentProps<"div">, "children"> {
  /** Row label (renders left-aligned, muted). */
  label: ReactNode;
  /** Row value (renders right-aligned, foreground). */
  value: ReactNode;
}

/** Key-value row primitive. Adjacent rows get an automatic top divider. */
export function PanelRow({ label, value, className, ...props }: PanelRowProps) {
  return (
    <div {...props} data-slot="panel-row" className={cn("text-xs", className)}>
      <span data-slot="panel-row-label" className="text-muted-foreground">
        {label}
      </span>
      <span data-slot="panel-row-value" className="text-foreground">
        {value}
      </span>
    </div>
  );
}
