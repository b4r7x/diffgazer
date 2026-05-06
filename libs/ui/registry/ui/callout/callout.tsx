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
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  layout?: CalloutLayout;
  ref?: Ref<HTMLDivElement>;
}

const variantRole: Record<CalloutVariant, string | undefined> = {
  info: undefined,
  warning: "status",
  error: "alert",
  success: "status",
};

export function Callout({
  className,
  variant = "info",
  visible: controlledVisible,
  defaultVisible,
  onVisibleChange,
  layout = "column",
  ref,
  children,
  ...props
}: CalloutProps) {
  const [visible, setVisible] = useControllableState({
    value: controlledVisible,
    defaultValue: defaultVisible ?? true,
    onChange: onVisibleChange,
  });

  const onDismiss = useCallback(() => setVisible(false), [setVisible]);

  const contextValue = useMemo(
    () => ({ variant, onDismiss }),
    [variant, onDismiss],
  );

  if (!visible) return null;

  return (
    <CalloutContext value={contextValue}>
      <div
        ref={ref}
        role={variantRole[variant]}
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
