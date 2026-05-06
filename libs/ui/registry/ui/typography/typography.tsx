import type { HTMLAttributes, Ref } from "react";
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

export interface TypographyProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: "div" | "p" | "span";
  ref?: Ref<HTMLElement>;
}

export function Typography({
  className,
  variant,
  size,
  lineClamp,
  as: Tag = "div",
  ref,
  ...rest
}: TypographyProps) {
  return (
    <Tag
      ref={ref as Ref<never>}
      className={cn(typographyVariants({ variant, size, lineClamp }), className)}
      {...rest}
    />
  );
}
