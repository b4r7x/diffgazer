import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, ElementType } from "react";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";

/** Class variants for card. */
export const cardVariants = cva("w-full relative rounded-sm bg-background", {
  variants: {
    surface: {
      flat: "border border-border/50",
      stacked:
        "border border-border/50 shadow-[3px_3px_0_0_var(--background),4px_4px_0_0_color-mix(in_oklab,var(--foreground)_30%,transparent)]",
      inset:
        "border border-border/50 bg-[color-mix(in_oklab,var(--foreground)_6%,var(--background))]",
      dotted: "border border-dashed border-border/70 bg-transparent",
      glow: "border border-border/50 outline-1 outline-offset-0 outline-foreground/40",
    },
    size: {
      default: "",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
    },
    interactive: {
      true: `cursor-pointer transition-[border-color,background-color,box-shadow,outline-color] duration-150 ease-out hover:border-border hover:bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))] ${FOCUS_OUTLINE}`,
      false: "",
    },
  },
  compoundVariants: [
    {
      surface: "stacked",
      interactive: true,
      className:
        "hover:shadow-[5px_5px_0_0_var(--background),6px_6px_0_0_color-mix(in_oklab,var(--foreground)_45%,transparent)]",
    },
    {
      surface: "inset",
      interactive: true,
      className: "hover:bg-[color-mix(in_oklab,var(--foreground)_10%,var(--background))]",
    },
    {
      surface: "glow",
      interactive: true,
      className: "hover:outline-foreground/70",
    },
  ],
  defaultVariants: { surface: "flat", size: "default", interactive: false },
});

/** Props for card own. */
type CardOwnProps = VariantProps<typeof cardVariants>;
type CardElement = "div" | "article" | "section" | "aside" | "a" | "button";

/** Props for card. */
export type CardProps<T extends CardElement = "div"> = Omit<
  ComponentPropsWithRef<T>,
  keyof CardOwnProps | "as"
> &
  CardOwnProps & {
    as?: T;
  };

/** Main card surface with surface, size, interactive, and as props. */
export function Card<T extends CardElement = "div">(props: CardProps<T>) {
  const { as, ref, className, surface, size, interactive, ...rest } =
    props as CardProps<CardElement>;
  // The host element is only known at the call site, so the JSX tag is typed as
  // a permissive ElementType; per-element prop validation happens at the call
  // site through CardProps<T>.
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      data-slot="card"
      data-surface={surface ?? "flat"}
      data-interactive={interactive || undefined}
      // polymorphic ref: the element type is only known at the call site,
      // so the ref type cannot be narrowed inside the generic component body.
      ref={ref as never}
      className={cn(cardVariants({ surface, size, interactive }), className)}
      {...rest}
    />
  );
}
