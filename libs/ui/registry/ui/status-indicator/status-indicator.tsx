import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export type StatusIndicatorStatus = "online" | "offline" | "busy";

export const statusIndicatorDotVariants = cva("inline-block h-1.5 w-1.5 shrink-0 rounded-full", {
  variants: {
    status: {
      online: "bg-primary",
      offline: "bg-muted-foreground",
      busy: "bg-warning",
    },
    pulse: {
      true: "animate-pulse motion-reduce:animate-none",
      false: "",
    },
  },
  defaultVariants: {
    status: "online",
    pulse: false,
  },
});

export interface StatusIndicatorProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusIndicatorDotVariants> {
  children?: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

export function StatusIndicator({
  ref,
  className,
  status = "online",
  pulse = true,
  children,
  ...props
}: StatusIndicatorProps) {
  const shouldPulse = pulse && status === "online";

  return (
    <span
      ref={ref}
      role="status"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={statusIndicatorDotVariants({ status, pulse: shouldPulse })}
      />
      {children}
    </span>
  );
}
