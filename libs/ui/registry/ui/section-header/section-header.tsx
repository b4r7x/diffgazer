import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

type HeadingTag = "h2" | "h3" | "h4";

export const sectionHeaderVariants = cva(
  "font-bold mb-2 uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "text-foreground",
        muted: "text-muted-foreground",
      },
      bordered: {
        true: "border-b border-border pb-2",
      },
      as: {
        h2: "text-sm",
        h3: "text-xs",
        h4: "text-[11px]",
      },
    },
    defaultVariants: { variant: "default", bordered: false, as: "h3" },
  },
);

export interface SectionHeaderProps
  extends HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof sectionHeaderVariants> {
  as?: HeadingTag;
  ref?: Ref<HTMLHeadingElement>;
}

export function SectionHeader({
  ref,
  className,
  variant,
  bordered,
  as: Tag = "h3",
  children,
  ...props
}: SectionHeaderProps) {
  return (
    <Tag
      ref={ref}
      className={cn(sectionHeaderVariants({ variant, bordered, as: Tag }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
