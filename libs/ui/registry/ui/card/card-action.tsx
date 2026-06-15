import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for card action. */
export type CardActionProps = ComponentPropsWithRef<"div">;

/** Action slot in header (positioned top-right via grid) */
export function CardAction({ className, ...props }: CardActionProps) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}
