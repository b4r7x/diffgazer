"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, MouseEvent } from "react";
import { cn } from "@/lib/utils";

/** Props for label. */
export interface LabelProps extends ComponentPropsWithRef<"label"> {
  /** Color token applied to the label text. */
  color?: LabelColor;
  /**
   * When set, switches to wrapper mode: renders the label text alongside children inside a
   * single native <label>.
   */
  label?: string;
  /**
   * Wrapper-mode layout direction. Vertical stacks the label above; horizontal places it
   * inline.
   */
  orientation?: LabelOrientation;
  /** Appends a destructive-colored required indicator after the label text. */
  required?: boolean;
}

/** Class variants for label. */
export const labelVariants = cva("text-xs uppercase font-bold select-none", {
  variants: {
    color: {
      default: "text-muted-foreground",
      primary: "text-foreground",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
    },
  },
  defaultVariants: { color: "default" },
});

/** Class variants for label wrapper. */
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

/**
 * Styled label with optional form control wrapping. Standalone mode renders colored uppercase
 * text. Wrapper mode (via label prop) renders the label above or beside children content.
 */
export type LabelColor = NonNullable<VariantProps<typeof labelVariants>["color"]>;
/**
 * Styled label with optional form control wrapping. Standalone mode renders colored uppercase
 * text. Wrapper mode (via label prop) renders the label above or beside children content.
 */
export type LabelOrientation = NonNullable<
  VariantProps<typeof labelWrapperVariants>["orientation"]
>;

function RequiredIndicator() {
  return (
    <span className="text-error" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

/**
 * Styled label with optional form control wrapping. Standalone mode renders colored uppercase
 * text. Wrapper mode (via label prop) renders the label above or beside children content.
 */
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
      // biome-ignore lint/a11y/noLabelWithoutControl: reusable Label primitive; the control is associated by the consumer (or Field) via htmlFor on ...props or by nesting the control as a child, neither of which Biome can see.
      <label
        ref={ref}
        data-slot="label"
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
    // biome-ignore lint/a11y/noLabelWithoutControl: reusable Label primitive; the control is associated by the consumer (or Field) via htmlFor on ...props or by nesting the control as a child, neither of which Biome can see.
    <label
      ref={ref}
      data-slot="label"
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
