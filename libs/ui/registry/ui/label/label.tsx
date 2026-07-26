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
export const labelVariants = cva("text-xs uppercase font-bold tracking-wider select-none", {
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
  // The disabled dim lands on the label text only (group/label), not the wrapper:
  // the wrapped control already dims itself, and stacking two opacities made it
  // nearly invisible. Horizontal aligns on the first text baseline so a wrapped
  // two-line label still sits on the control's text line.
  "group/label has-[:disabled]:cursor-not-allowed",
  {
    variants: {
      orientation: {
        vertical: "flex flex-col gap-1",
        horizontal: "flex items-baseline gap-2",
      },
    },
    defaultVariants: { orientation: "vertical" },
  },
);

export type LabelColor = NonNullable<VariantProps<typeof labelVariants>["color"]>;
export type LabelOrientation = NonNullable<
  VariantProps<typeof labelWrapperVariants>["orientation"]
>;

/**
 * The " *" marker appended to a required label.
 *
 * Muted at rest, escalating to the error hue only while the surrounding Field is invalid: a form
 * with four required fields used to put four error-hue marks on screen before the user had done
 * anything, so the one mark that meant "this is broken" had to out-shout them. `group/field` is
 * written by the Field root, so a standalone Label keeps the muted marker permanently — it has no
 * validity to read.
 */
export function RequiredIndicator() {
  return (
    <span
      className="text-muted-foreground group-data-[invalid]/field:text-error"
      aria-hidden="true"
    >
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
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    const ElementConstructor = event.currentTarget.ownerDocument.defaultView?.Element;
    if (
      ElementConstructor &&
      event.target instanceof ElementConstructor &&
      event.target.closest("button, input, select, textarea")
    ) {
      return;
    }
    if (event.detail > 1) event.preventDefault();
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
        <span
          className={cn(
            labelVariants({ color }),
            // Token, not opacity: a faded label straddled the 4.5:1 line and vanished entirely
            // in forced-colors mode, which ignores opacity.
            "group-has-[:disabled]/label:text-muted-foreground group-has-[:disabled]/label:forced-colors:text-[GrayText]",
          )}
        >
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
      className={cn(labelVariants({ color }), className)}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {children}
      {required && <RequiredIndicator />}
    </label>
  );
}
