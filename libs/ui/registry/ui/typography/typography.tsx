import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const typographyVariants = cva("font-mono text-muted-foreground", {
  variants: {
    variant: {
      default: "leading-relaxed",
      prose: "leading-loose",
      compact: "leading-normal",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
    },
    lineClamp: {
      1: "line-clamp-1",
      2: "line-clamp-2",
      3: "line-clamp-3",
      4: "line-clamp-4",
      5: "line-clamp-5",
      6: "line-clamp-6",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

type TypographyOwnProps = VariantProps<typeof typographyVariants>;
type TypographyElement = "div" | "p" | "span";
type TypographyElementProps<T extends TypographyElement> = Omit<
  ComponentPropsWithRef<T>,
  keyof TypographyOwnProps | "as"
> &
  TypographyOwnProps & {
    as: T;
  };

export type TypographyProps =
  | (Omit<TypographyElementProps<"div">, "as"> & { as?: "div" })
  | TypographyElementProps<"p">
  | TypographyElementProps<"span">;

export function Typography(props: TypographyProps) {
  const { className, variant, size, lineClamp } = props;
  const resolvedClassName = cn(typographyVariants({ variant, size, lineClamp }), className);

  if (props.as === "p") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, lineClamp: omittedLineClamp, ...pProps } = props;
    return <p ref={ref} className={resolvedClassName} {...pProps} />;
  }
  if (props.as === "span") {
    const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, lineClamp: omittedLineClamp, ...spanProps } = props;
    return <span ref={ref} className={resolvedClassName} {...spanProps} />;
  }

  const { as, ref, className: omittedClassName, variant: omittedVariant, size: omittedSize, lineClamp: omittedLineClamp, ...divProps } = props;
  return (
    <div ref={ref} className={resolvedClassName} {...divProps} />
  );
}
