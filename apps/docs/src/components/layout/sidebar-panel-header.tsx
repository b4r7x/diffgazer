import { cn } from "@diffgazer/ui/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";

export function SidebarPanelHeader({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function SidebarPanelHeaderRow({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2 px-3 py-2", className)} {...rest}>
      {children}
    </div>
  );
}

export function SidebarPanelHeaderLabel({ children }: { children: ReactNode }) {
  return <span className={`shrink-0 ${CHROME_LABEL_CLASS}`}>{children}</span>;
}

export function SidebarPanelHeaderDivider() {
  return <div className="border-t border-border" aria-hidden="true" />;
}
