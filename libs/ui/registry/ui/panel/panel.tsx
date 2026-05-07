import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const panelVariants = cva("relative bg-background", {
  variants: {
    variant: {
      default: "border border-border shadow-2xl",
      borderless: "",
    },
  },
  defaultVariants: { variant: "default" },
});

type PanelOwnProps = VariantProps<typeof panelVariants>;
type PanelElement = "div" | "article" | "section" | "aside";
type PanelElementProps<T extends PanelElement> = Omit<
  ComponentPropsWithRef<T>,
  keyof PanelOwnProps | "as"
> &
  PanelOwnProps & {
    as: T;
  };

export type PanelProps =
  | (Omit<PanelElementProps<"div">, "as"> & { as?: "div" })
  | PanelElementProps<"article">
  | PanelElementProps<"section">
  | PanelElementProps<"aside">;

export function Panel(props: PanelProps) {
  const { className, variant } = props;
  const resolvedClassName = cn(panelVariants({ variant }), className);

  if (props.as === "article") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, ...articleProps } = props;
    return <article data-slot="panel" ref={ref} className={resolvedClassName} {...articleProps} />;
  }
  if (props.as === "section") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, ...sectionProps } = props;
    return <section data-slot="panel" ref={ref} className={resolvedClassName} {...sectionProps} />;
  }
  if (props.as === "aside") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, ...asideProps } = props;
    return <aside data-slot="panel" ref={ref} className={resolvedClassName} {...asideProps} />;
  }

  const { as, ref, className: omittedClassName, variant: omittedVariant, ...divProps } = props;
  return <div data-slot="panel" ref={ref} className={resolvedClassName} {...divProps} />;
}
