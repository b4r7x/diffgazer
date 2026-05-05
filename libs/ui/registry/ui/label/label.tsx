"use client";

import type { ComponentPropsWithRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type LabelColor = "default" | "primary" | "success" | "warning" | "error";
export type LabelOrientation = "vertical" | "horizontal";

export interface LabelProps extends ComponentPropsWithRef<"label"> {
  color?: LabelColor;
  label?: string;
  orientation?: LabelOrientation;
  required?: boolean;
}

export const labelVariants = cva("text-xs uppercase font-bold select-none", {
  variants: {
    color: {
      default: "text-muted-foreground",
      primary: "text-foreground",
      success: "text-success",
      warning: "text-warning",
      error: "text-destructive",
    },
  },
  defaultVariants: { color: "default" },
});

function RequiredIndicator() {
  return <span className="text-destructive" aria-hidden="true"> *</span>;
}

export function Label({
  color = "default",
  label,
  orientation = "vertical",
  required,
  className,
  ref,
  children,
  onMouseDown,
  ...props
}: LabelProps) {
  const handleMouseDown = (event: React.MouseEvent<HTMLLabelElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea")) return;
    onMouseDown?.(event);
    if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
  };

  if (label) {
    return (
      <label
        ref={ref}
        className={cn(
          orientation === "vertical" ? "flex flex-col gap-1" : "flex items-center gap-2",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70",
          className,
        )}
        onMouseDown={handleMouseDown}
        {...props}
      >
        <span className={labelVariants({ color })}>
          {label}
          {required && <RequiredIndicator />}
        </span>
        {children}
      </label>
    );
  }

  return (
    <label
      ref={ref}
      className={cn(
        labelVariants({ color }),
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {children}
      {required && <RequiredIndicator />}
    </label>
  );
}
