import type { ReactNode, KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { useTabsContext } from "./tabs-context";

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  const { value, onValueChange, getTriggers, orientation } = useTabsContext();

  const handleKeyDown = (event: KeyboardEvent) => {
    const isHorizontal = orientation === "horizontal";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

    if (
      event.key !== prevKey &&
      event.key !== nextKey &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const triggers = getTriggers();
    const items = Array.from(triggers.entries()).filter(([, el]) => {
      return el && !el.disabled;
    });
    if (items.length === 0) return;

    const currentIndex = items.findIndex(([itemValue]) => itemValue === value);

    let nextIndex: number;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === prevKey) {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    }

    const nextItem = items[nextIndex];
    if (nextItem) {
      onValueChange(nextItem[0]);
      nextItem[1]?.focus();
    }
  };

  return (
    <div
      className={cn(
        "flex gap-1 font-mono",
        orientation === "vertical" && "flex-col",
        className
      )}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
