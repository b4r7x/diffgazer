import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for card title. */
export type CardTitleProps = ComponentPropsWithRef<"h3"> & {
  as?: "h2" | "h3" | "h4" | "h5";
};

/** Title text with configurable heading level (as prop) */
export function CardTitle({ as: Tag = "h3", className, ...props }: CardTitleProps) {
  return (
    <Tag
      data-slot="card-title"
      className={cn("text-xl font-bold text-foreground tracking-wide", className)}
      {...props}
    />
  );
}
