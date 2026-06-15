import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type HeadingTag = "h2" | "h3" | "h4";

/** Class variants for section header. */
export const sectionHeaderVariants = cva("font-bold mb-2 uppercase tracking-wider", {
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
});

/** Props for section header. */
export interface SectionHeaderProps
  extends ComponentProps<"h2">,
    VariantProps<typeof sectionHeaderVariants> {
  /** Heading level. Choose the level that matches your document outline. */
  as?: HeadingTag;
}

/**
 * Uppercase heading element for labeling content sections, with configurable heading level and
 * variant.
 */
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
      data-slot="section-header"
      className={cn(sectionHeaderVariants({ variant, bordered, as: Tag }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
