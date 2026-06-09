import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

export function SidebarPanelHeader({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function SidebarPanelHeaderRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2 px-3 py-2", className)}>{children}</div>
  );
}

export function SidebarPanelHeaderLabel({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

export function SidebarPanelHeaderDivider() {
  return <div className="border-t border-border" aria-hidden="true" />;
}
