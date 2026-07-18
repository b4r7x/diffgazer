import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for kbd group. */
export interface KbdGroupProps extends ComponentProps<"kbd"> {}

/** Groups inline keyboard key indicators with a small gap. */
export function KbdGroup({ ref, className, children, ...props }: KbdGroupProps) {
  return (
    <kbd ref={ref} className={cn("inline-flex items-center gap-1", className)} {...props}>
      {children}
    </kbd>
  );
}
