import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type PanelFooterProps = ComponentPropsWithRef<"div">;

export function PanelFooter({ className, ...props }: PanelFooterProps) {
  return <div data-slot="panel-footer" className={cn("border-t border-border bg-secondary/30 px-4 py-3 text-sm", className)} {...props} />;
}
