import { useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { NavigationListContext } from "./navigation-list-context";

export interface NavigationListProps {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  keyboardEnabled?: boolean;
  isFocused?: boolean;
  className?: string;
  children: ReactNode;
  onBoundaryReached?: (direction: "up" | "down") => void;
  "aria-label"?: string;
}

export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  isFocused = true,
  className,
  children,
  onBoundaryReached,
  "aria-label": ariaLabel,
}: NavigationListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(defaultSelectedId);

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledId;
  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    else setUncontrolledId(id);
  };

  const getItems = (): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('[role="option"]')
    );
  };

  const getEnabledItems = (): HTMLElement[] => {
    return getItems().filter((item) => item.getAttribute("aria-disabled") !== "true");
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!keyboardEnabled) return;
    if (
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Home" &&
      event.key !== "End" &&
      event.key !== "Enter"
    ) {
      return;
    }

    event.preventDefault();

    if (event.key === "Enter") {
      if (!selectedId) return;
      const selectedItem = getItems().find(
        (item) => item.getAttribute("data-value") === selectedId
      );
      if (selectedItem?.getAttribute("aria-disabled") !== "true") {
        onActivate?.(selectedId);
      }
      return;
    }

    const items = getEnabledItems();
    if (items.length === 0) return;

    if (event.key === "Home") {
      const firstItemValue = items[0]?.getAttribute("data-value");
      if (firstItemValue) handleSelect(firstItemValue);
      return;
    }

    if (event.key === "End") {
      const lastItemValue = items[items.length - 1]?.getAttribute("data-value");
      if (lastItemValue) handleSelect(lastItemValue);
      return;
    }

    const currentIndex = items.findIndex(
      (el) => el.getAttribute("data-value") === selectedId
    );

    if (event.key === "ArrowUp") {
      if (currentIndex < 0) {
        const lastItemValue = items[items.length - 1]?.getAttribute("data-value");
        if (lastItemValue) handleSelect(lastItemValue);
        return;
      }
      if (currentIndex <= 0) {
        onBoundaryReached?.("up");
        return;
      }
      const prevItem = items[currentIndex - 1];
      if (prevItem) {
        const value = prevItem.getAttribute("data-value");
        if (value) handleSelect(value);
      }
    } else {
      if (currentIndex < 0) {
        const firstItemValue = items[0]?.getAttribute("data-value");
        if (firstItemValue) handleSelect(firstItemValue);
        return;
      }
      if (currentIndex >= items.length - 1) {
        onBoundaryReached?.("down");
        return;
      }
      const nextItem = items[currentIndex + 1];
      if (nextItem) {
        const value = nextItem.getAttribute("data-value");
        if (value) handleSelect(value);
      }
    }
  };

  const contextValue = { selectedId, onSelect: handleSelect, onActivate, isFocused };

  return (
    <NavigationListContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={selectedId ? `navlist-${selectedId}` : undefined}
        tabIndex={0}
        className={cn("w-full outline-none", className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}
