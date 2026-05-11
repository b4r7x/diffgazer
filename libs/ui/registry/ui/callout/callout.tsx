"use client";

import { type ReactNode, type HTMLAttributes, type Ref, useCallback, useMemo } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { CalloutContext, type CalloutVariant } from "./callout-context";

export const calloutVariants = cva("relative border font-mono p-4", {
  variants: {
    variant: {
      info: "border-info-border/40 bg-info-subtle",
      warning: "border-warning-border/40 bg-warning-subtle",
      error: "border-error-border/40 bg-error-subtle",
      success: "border-success-border/40 bg-success-subtle",
    },
  },
  defaultVariants: { variant: "info" },
});

type CalloutLayout = "column" | "inline" | "none";

const layoutClasses = {
  column: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1",
  inline: "flex flex-wrap items-center gap-4",
  none: "",
} as const;

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CalloutVariant;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  layout?: CalloutLayout;
  /** Adds live-region semantics. Error callouts are alerts by default. */
  live?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const variantRole: Record<CalloutVariant, string | undefined> = {
  info: "status",
  warning: "status",
  error: "alert",
  success: "status",
};

function getRole(variant: CalloutVariant, live: boolean): string | undefined {
  if (variant === "error") return "alert";
  if (live) return variantRole[variant];
  return undefined;
}

export function Callout({
  className,
  variant = "info",
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  layout = "column",
  live = false,
  ref,
  children,
  ...props
}: CalloutProps) {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? true,
    onChange: onOpenChange,
  });

  const onDismiss = useCallback(() => setOpen(false), [setOpen]);

  const contextValue = useMemo(
    () => ({ variant, onDismiss }),
    [variant, onDismiss],
  );

  if (!open) return null;

  const role = getRole(variant, live);

  return (
    <CalloutContext value={contextValue}>
      <div
        ref={ref}
        role={role}
        className={cn(
          calloutVariants({ variant }),
          layoutClasses[layout],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </CalloutContext>
  );
}
