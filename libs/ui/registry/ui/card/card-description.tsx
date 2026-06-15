import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for card description. */
export type CardDescriptionProps = ComponentPropsWithRef<"p">;

/** Supporting description text. */
export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
