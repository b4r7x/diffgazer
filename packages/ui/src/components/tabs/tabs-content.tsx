import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useTabsContext } from "./tabs-context";

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();
  const isActive = selectedValue === value;

  if (!isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      data-state={isActive ? "active" : "inactive"}
      className={cn("mt-2", className)}
    >
      {children}
    </div>
  );
}
