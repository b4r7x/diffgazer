import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  value: ReactNode;
}

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
