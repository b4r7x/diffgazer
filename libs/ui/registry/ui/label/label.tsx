"use client";

import type { ComponentPropsWithRef, MouseEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

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

export const labelWrapperVariants = cva(
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70",
  {
    variants: {
      orientation: {
        vertical: "flex flex-col gap-1",
        horizontal: "flex items-center gap-2",
      },
    },
    defaultVariants: { orientation: "vertical" },
  },
);

export type LabelColor = NonNullable<VariantProps<typeof labelVariants>["color"]>;
export type LabelOrientation = NonNullable<VariantProps<typeof labelWrapperVariants>["orientation"]>;

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
  const handleMouseDown = (event: MouseEvent<HTMLLabelElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea")) return;
    onMouseDown?.(event);
    if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
  };

  if (label) {
    return (
      <label
        ref={ref}
        className={cn(labelWrapperVariants({ orientation }), className)}
        onMouseDown={handleMouseDown}
        {...props}
      >
        <span className={cn(labelVariants({ color }))}>
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
