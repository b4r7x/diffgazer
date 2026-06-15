import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for card content. */
export type CardContentProps = ComponentPropsWithRef<"div">;

/** Body content region. */
export function CardContent({ className, ...props }: CardContentProps) {
  return <div data-slot="card-content" className={cn("p-6", className)} {...props} />;
}
