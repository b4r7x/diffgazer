import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type CardHeaderProps = ComponentPropsWithRef<"div">;

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 border-b border-border px-4 py-3 text-sm text-foreground has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}
