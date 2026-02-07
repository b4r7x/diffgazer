import { useImperativeHandle, useRef, useState, type ReactNode, type KeyboardEvent, type Ref } from "react";
import { cn } from "../../lib/cn";
import type { NavigableHandle } from "../../internal/use-local-navigation";
import { MenuContext, type InternalMenuItemData, type MenuContextValue } from "./menu-context";

export interface MenuProps<T extends string = string> {
  selectedIndex?: number;
  defaultIndex?: number;
  onSelect?: (index: number) => void;
  onActivate?: (item: InternalMenuItemData<T>) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  variant?: "default" | "hub";
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
  ref?: Ref<NavigableHandle>;
}

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Menu<T extends string = string>({
  selectedIndex: controlledIndex,
  defaultIndex = 0,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  variant = "default",
  className,
  "aria-label": ariaLabel,
  children,
  ref,
}: MenuProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<string, InternalMenuItemData>>(new Map());
  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);

  const selectedIndex = controlledIndex !== undefined ? controlledIndex : uncontrolledIndex;
  const handleSelect = (index: number) => {
    if (onSelect) onSelect(index);
    else setUncontrolledIndex(index);
  };

  const registerItem = (id: string, data: InternalMenuItemData) => {
    itemsRef.current.set(id, data);
  };

  const unregisterItem = (id: string) => {
    itemsRef.current.delete(id);
  };

  const getItemsByIndex = () => {
    if (containerRef.current) {
      const optionNodes = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>('[role="option"]')
      );
      return optionNodes
        .map((node, index) => {
          const id = node.getAttribute("data-value");
          if (!id) return null;
          return {
            id,
            index,
            disabled: node.getAttribute("aria-disabled") === "true",
          } satisfies InternalMenuItemData;
        })
        .filter((item): item is InternalMenuItemData => item !== null);
    }

    return Array.from(itemsRef.current.values()).sort((a, b) => a.index - b.index);
  };

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    const sorted = getItemsByIndex();
    let index = start + direction;
    while (index >= 0 && index < sorted.length) {
      if (!sorted[index]?.disabled) return index;
      index += direction;
    }
    return start;
  };

  // Get the active item ID for aria-activedescendant
  const getActiveItemId = (): string | undefined => {
    const sorted = getItemsByIndex();
    const item = sorted[selectedIndex];
    return item ? `menu-item-${item.id}` : undefined;
  };

  const selectPrevious = () => {
    const newIndex = findNextIndex(selectedIndex, -1);
    if (newIndex !== selectedIndex) handleSelect(newIndex);
  };

  const selectNext = () => {
    const newIndex = findNextIndex(selectedIndex, 1);
    if (newIndex !== selectedIndex) handleSelect(newIndex);
  };

  const activateSelected = () => {
    const sorted = getItemsByIndex();
    const item = sorted[selectedIndex];
    if (item && !item.disabled) onActivate?.(item as InternalMenuItemData<T>);
  };

  const selectByNumber = (index: number) => {
    const sorted = getItemsByIndex();
    const item = sorted[index];
    if (item && !item.disabled) {
      handleSelect(index);
      onActivate?.(item as InternalMenuItemData<T>);
    }
  };

  useImperativeHandle(ref, () => ({
    focusNext: selectNext,
    focusPrevious: selectPrevious,
    focusFirst: () => {
      const sorted = getItemsByIndex();
      const firstEnabled = sorted.findIndex((item) => !item.disabled);
      if (firstEnabled >= 0) handleSelect(firstEnabled);
    },
    focusLast: () => {
      const sorted = getItemsByIndex();
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (!sorted[i]?.disabled) {
          handleSelect(i);
          return;
        }
      }
    },
    selectFocused: activateSelected,
    getFocusedValue: () => {
      const sorted = getItemsByIndex();
      return sorted[selectedIndex]?.id ?? null;
    },
  }));

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!keyboardEnabled) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectPrevious();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      selectNext();
    } else if (event.key === "Enter") {
      event.preventDefault();
      activateSelected();
    } else if (enableNumberJump && NUMBER_KEYS.includes(event.key)) {
      event.preventDefault();
      const index = parseInt(event.key, 10) - 1;
      selectByNumber(index);
    }
  };

  const contextValue: MenuContextValue = {
    selectedIndex,
    onSelect: handleSelect,
    onActivate: onActivate as ((item: InternalMenuItemData) => void) | undefined,
    registerItem,
    unregisterItem,
    variant,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={getActiveItemId()}
        tabIndex={0}
        className={cn("w-full relative outline-none", className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}
