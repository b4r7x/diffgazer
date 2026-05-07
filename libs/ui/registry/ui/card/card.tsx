import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva("w-full relative border border-border bg-background", {
  variants: {
    variant: {
      default: "",
      panel: "shadow-2xl",
    },
    size: {
      default: "",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type CardOwnProps = VariantProps<typeof cardVariants>;
type CardElement = "div" | "article" | "section" | "aside";
type CardElementProps<T extends CardElement> = Omit<
  ComponentPropsWithRef<T>,
  keyof CardOwnProps | "as"
> &
  CardOwnProps & {
    as: T;
  };

export type CardProps =
  | (Omit<CardElementProps<"div">, "as"> & { as?: "div" })
  | CardElementProps<"article">
  | CardElementProps<"section">
  | CardElementProps<"aside">;

export function Card(props: CardProps) {
  const { className, variant, size } = props;
  const resolvedClassName = cn(cardVariants({ variant, size }), className);

  if (props.as === "article") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, ...articleProps } = props;
    return <article data-slot="card" ref={ref} className={resolvedClassName} {...articleProps} />;
  }
  if (props.as === "section") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, ...sectionProps } = props;
    return <section data-slot="card" ref={ref} className={resolvedClassName} {...sectionProps} />;
  }
  if (props.as === "aside") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, ...asideProps } = props;
    return <aside data-slot="card" ref={ref} className={resolvedClassName} {...asideProps} />;
  }

  const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, ...divProps } = props;
  return <div data-slot="card" ref={ref} className={resolvedClassName} {...divProps} />;
}
