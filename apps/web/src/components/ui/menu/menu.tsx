"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useKey, useKeys } from "@/hooks/keyboard";
import { MenuContext, type InternalMenuItemData, type MenuContextValue } from "./menu-context";
import { MenuItem, type MenuItemProps } from "./menu-item";

export interface MenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: { id: string; disabled: boolean; index: number }) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  variant?: "default" | "hub";
  className?: string;
  children: ReactNode;
}

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function Menu({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  variant = "default",
  className,
  children,
}: MenuProps) {
  const items: InternalMenuItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems((child.props as { children?: ReactNode }).children);
        return;
      }
      if (child.type === MenuItem) {
        const props = child.props as MenuItemProps;
        items.push({
          id: props.id,
          disabled: props.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  extractItems(children);

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    let index = start + direction;
    while (index >= 0 && index < items.length) {
      if (!items[index]?.disabled) return index;
      index += direction;
    }
    return start;
  };

  useKey(
    "ArrowUp",
    () => {
      const newIndex = findNextIndex(selectedIndex, -1);
      if (newIndex !== selectedIndex) onSelect(newIndex);
    },
    { enabled: keyboardEnabled }
  );

  useKey(
    "ArrowDown",
    () => {
      const newIndex = findNextIndex(selectedIndex, 1);
      if (newIndex !== selectedIndex) onSelect(newIndex);
    },
    { enabled: keyboardEnabled }
  );

  useKey(
    "Enter",
    () => {
      const item = items[selectedIndex];
      if (item && !item.disabled) onActivate?.(item);
    },
    { enabled: keyboardEnabled }
  );

  useKeys(
    NUMBER_KEYS,
    (key) => {
      const index = parseInt(key, 10) - 1;
      const item = items[index];
      if (item && !item.disabled) {
        onSelect(index);
        onActivate?.(item);
      }
    },
    { enabled: keyboardEnabled && enableNumberJump }
  );

  const contextValue: MenuContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
    variant,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <div role="listbox" className={cn("w-full relative", className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}
