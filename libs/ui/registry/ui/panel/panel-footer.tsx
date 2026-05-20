import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type PanelFooterProps = ComponentPropsWithRef<"div">;

export function PanelFooter({ className, ...props }: PanelFooterProps) {
  return (
    <div
      {...props}
      data-slot="panel-footer"
      className={cn("text-xs text-muted-foreground", className)}
    />
  );
}
