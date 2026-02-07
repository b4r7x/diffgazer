import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface KeyValueRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function KeyValueRow({ label, value, className }: KeyValueRowProps) {
  return (
    <div className={cn("flex justify-between items-center text-xs py-2 border-b border-tui-border", className)}>
      <span className="text-tui-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
