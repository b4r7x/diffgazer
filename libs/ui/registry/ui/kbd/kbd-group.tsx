import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface KbdGroupProps extends ComponentProps<"kbd"> {}

export function KbdGroup({ ref, className, children, ...props }: KbdGroupProps) {
  return (
    <kbd ref={ref} className={cn("inline-flex items-center gap-1", className)} {...props}>
      {children}
    </kbd>
  );
}
