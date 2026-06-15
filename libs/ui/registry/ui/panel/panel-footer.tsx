import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for panel footer. */
export type PanelFooterProps = ComponentPropsWithRef<"div">;

/** Bottom metadata/action row. */
export function PanelFooter({ className, ...props }: PanelFooterProps) {
  return (
    <div
      {...props}
      data-slot="panel-footer"
      className={cn("text-xs text-muted-foreground", className)}
    />
  );
}
