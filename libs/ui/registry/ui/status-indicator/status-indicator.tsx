import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Allowed status indicator status values. */
export type StatusIndicatorStatus = "online" | "offline" | "busy";

/** Class variants for status indicator dot. */
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

/** Props for status indicator. */
export interface StatusIndicatorProps
  extends ComponentProps<"span">,
    Omit<VariantProps<typeof statusIndicatorDotVariants>, "status" | "pulse"> {
  /** Semantic status. Drives the dot color and the default sr-only status word. */
  status?: StatusIndicatorStatus;
  /** Animate the dot. Only the online status animates; busy and offline never pulse. */
  pulse?: boolean;
  /**
   * Screen-reader status word announced alongside the color-only dot (WCAG 1.4.1). Defaults to
   * the `status` value. Pass `null` to suppress it when the visible children already state the
   * status.
   */
  label?: string | null;
}

/** Inline status row: pulsing dot (optional) plus children label text. */
export function StatusIndicator({
  ref,
  className,
  status,
  pulse,
  label,
  children,
  ...props
}: StatusIndicatorProps) {
  const resolvedStatus = status ?? "online";
  const pulseActive = resolvedStatus === "online" && (pulse ?? true);
  const statusWord = label === undefined ? resolvedStatus : label;

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" provides the polite live-region semantics for the readout; <output> carries form-association semantics that do not fit here.
    <span
      ref={ref}
      role="status"
      data-slot="status-indicator"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="status-indicator-dot"
        data-status={resolvedStatus}
        data-pulse={pulseActive || undefined}
        className={statusIndicatorDotVariants({ status, pulse })}
      />
      {statusWord && <span className="sr-only">{statusWord}</span>}
      {children}
    </span>
  );
}
