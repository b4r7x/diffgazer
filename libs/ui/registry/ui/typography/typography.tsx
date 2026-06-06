import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const typographyVariants = cva("font-mono", {
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
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      default: "text-muted-foreground",
      muted: "text-muted-foreground",
      foreground: "text-foreground",
      accent: "text-primary",
    },
    lineClamp: {
      1: "line-clamp-1",
      2: "line-clamp-2",
      3: "line-clamp-3",
      4: "line-clamp-4",
      5: "line-clamp-5",
      6: "line-clamp-6",
    },
    truncate: {
      true: "truncate",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
    weight: "normal",
    color: "default",
    truncate: false,
  },
});

type TypographySize = NonNullable<VariantProps<typeof typographyVariants>["size"]>;
type TypographyWeight = NonNullable<VariantProps<typeof typographyVariants>["weight"]>;

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const HEADING_DEFAULT_SIZE: Record<HeadingTag, TypographySize> = {
  h1: "3xl",
  h2: "2xl",
  h3: "xl",
  h4: "lg",
  h5: "base",
  h6: "sm",
};

const HEADING_DEFAULT_WEIGHT: Record<HeadingTag, TypographyWeight> = {
  h1: "bold",
  h2: "bold",
  h3: "bold",
  h4: "bold",
  h5: "bold",
  h6: "bold",
};

type TypographyElement =
  | "div"
  | "p"
  | "span"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

type TypographyOwnProps = VariantProps<typeof typographyVariants>;

export type TypographyProps<T extends TypographyElement = "div"> = Omit<
  ComponentPropsWithRef<T>,
  keyof TypographyOwnProps | "as"
> &
  TypographyOwnProps & {
    as?: T;
  };

export function Typography<T extends TypographyElement = "div">(
  props: TypographyProps<T>,
) {
  const { as, className, variant, size, weight, color, lineClamp, truncate, ref, ...rest } =
    props as TypographyProps<TypographyElement>;
  const Tag = as ?? "div";
  const resolvedSize =
    size ?? (Tag in HEADING_DEFAULT_SIZE
      ? HEADING_DEFAULT_SIZE[Tag as keyof typeof HEADING_DEFAULT_SIZE]
      : undefined);
  const resolvedWeight =
    weight ?? (Tag in HEADING_DEFAULT_WEIGHT
      ? HEADING_DEFAULT_WEIGHT[Tag as keyof typeof HEADING_DEFAULT_WEIGHT]
      : undefined);
  return (
    <Tag
      // polymorphic ref: the element type is only known at the call site,
      // so the ref type cannot be narrowed inside the generic component body.
      ref={ref as never}
      className={cn(
        typographyVariants({ variant, size: resolvedSize, weight: resolvedWeight, color, lineClamp, truncate }),
        className,
      )}
      {...rest}
    />
  );
}
