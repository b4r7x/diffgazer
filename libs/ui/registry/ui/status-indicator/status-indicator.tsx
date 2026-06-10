import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, Ref } from "react";
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
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { status: "online", pulse: true, className: "animate-pulse motion-reduce:animate-none" },
  ],
  defaultVariants: {
    status: "online",
    pulse: true,
  },
});

export interface StatusIndicatorProps
  extends HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof statusIndicatorDotVariants>, "status" | "pulse"> {
  status?: StatusIndicatorStatus;
  pulse?: boolean;
  ref?: Ref<HTMLSpanElement>;
}

export function StatusIndicator({
  ref,
  className,
  status,
  pulse,
  children,
  ...props
}: StatusIndicatorProps) {
  const resolvedStatus = status ?? "online";
  const pulseActive = resolvedStatus === "online" && (pulse ?? true);

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" provides the polite live-region semantics for the readout; <output> carries form-association semantics that do not fit here.
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
        data-status={resolvedStatus}
        data-pulse={pulseActive || undefined}
        className={statusIndicatorDotVariants({ status, pulse })}
      />
      {children}
    </span>
  );
}
