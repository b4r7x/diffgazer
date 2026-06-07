import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const cardVariants = cva("w-full relative bg-background", {
  variants: {
    surface: {
      flat: "border border-border/50",
      stacked:
        "border border-border/50 shadow-[3px_3px_0_0_var(--background),4px_4px_0_0_color-mix(in_oklab,var(--border)_50%,transparent)]",
      inset:
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_0_0_1px_color-mix(in_oklab,var(--border)_25%,transparent)] bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))]",
      dotted: "border border-dashed border-border/70 bg-transparent",
      glow: "border border-border/50 shadow-[0_0_15px_color-mix(in_oklab,var(--border)_12%,transparent),0_0_5px_color-mix(in_oklab,var(--border)_8%,transparent)]",
    },
    size: {
      default: "",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
    },
    interactive: {
      true: "cursor-pointer transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
      false: "",
    },
  },
  compoundVariants: [
    {
      surface: "flat",
      interactive: true,
      className: "hover:border-border",
    },
    {
      surface: "stacked",
      interactive: true,
      className:
        "hover:shadow-[5px_5px_0_0_var(--background),6px_6px_0_0_color-mix(in_oklab,var(--border)_50%,transparent)]",
    },
    {
      surface: "inset",
      interactive: true,
      className:
        "hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),inset_0_0_0_1px_color-mix(in_oklab,var(--border)_35%,transparent)]",
    },
    {
      surface: "dotted",
      interactive: true,
      className: "hover:border-border",
    },
    {
      surface: "glow",
      interactive: true,
      className:
        "hover:border-border/70 hover:shadow-[0_0_20px_color-mix(in_oklab,var(--border)_18%,transparent),0_0_8px_color-mix(in_oklab,var(--border)_12%,transparent)]",
    },
  ],
  defaultVariants: { surface: "flat", size: "default", interactive: false },
});

type CardOwnProps = VariantProps<typeof cardVariants>;
type CardElement = "div" | "article" | "section" | "aside";

export type CardProps<T extends CardElement = "div"> = Omit<
  ComponentPropsWithRef<T>,
  keyof CardOwnProps | "as"
> &
  CardOwnProps & {
    as?: T;
  };

export function Card<T extends CardElement = "div">(props: CardProps<T>) {
  const { as, ref, className, surface, size, interactive, ...rest } =
    props as CardProps<CardElement>;
  const Tag = as ?? "div";
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
