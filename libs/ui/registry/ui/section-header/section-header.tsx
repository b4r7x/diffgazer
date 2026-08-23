import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type HeadingTag = "h2" | "h3" | "h4";

/**
 * Class variants for section header.
 *
 * The heading level owns size, weight, AND tracking: at these sizes a 1px size step alone is
 * imperceptible, so each level also loosens tracking and lightens weight to read as a scale.
 * No outside margin lives here — spacing belongs to the layout that places the header.
 */
export const sectionHeaderVariants = cva("uppercase", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      accent: "text-accent",
    },
    bordered: {
      true: "border-b border-border pb-2",
    },
    as: {
      h2: "text-sm font-bold tracking-[0.08em]",
      h3: "text-xs font-bold tracking-[0.14em]",
      h4: "text-[11px] font-medium tracking-[0.22em]",
    },
  },
  defaultVariants: { variant: "default", bordered: false, as: "h3" },
});

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
