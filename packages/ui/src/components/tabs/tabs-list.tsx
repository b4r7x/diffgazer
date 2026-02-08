import type { ReactNode, KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { useTabsContext } from "./tabs-context";

export interface TabsListProps {
  children: ReactNode;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export function TabsList({ children, className, onKeyDown }: TabsListProps) {
  const { orientation } = useTabsContext();

  return (
    <div
      className={cn(
        "flex gap-1 font-mono",
        orientation === "vertical" && "flex-col",
        className
      )}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
