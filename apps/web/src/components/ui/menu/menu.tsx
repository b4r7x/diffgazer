import { Children, Fragment, isValidElement, useMemo, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useKey, useKeys } from "@/hooks/keyboard";
import { MenuContext, type InternalMenuItemData, type MenuContextValue } from "./menu-context";
import { MenuItem, type MenuItemProps } from "./menu-item";

export interface MenuProps<T extends string = string> {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: InternalMenuItemData<T>) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  variant?: "default" | "hub";
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function Menu<T extends string = string>({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  variant = "default",
  className,
  "aria-label": ariaLabel,
  children,
}: MenuProps<T>) {
  const items = useMemo(() => {
    const result = new Map<string, InternalMenuItemData>();
    let idx = 0;

    function extract(node: ReactNode) {
      Children.forEach(node, (child) => {
        if (!isValidElement(child)) return;
        if (child.type === Fragment) {
          extract((child.props as { children?: ReactNode }).children);
          return;
        }
        if (child.type === MenuItem) {
          const props = child.props as MenuItemProps;
          const index = idx++;
          result.set(props.id, {
            id: props.id,
            disabled: props.disabled ?? false,
            index,
          });
        }
      });
    }

    extract(children);
    return result;
  }, [children]);

  const itemsByIndex = useMemo(
    () => Array.from(items.values()).sort((a, b) => a.index - b.index),
    [items]
  );

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    let index = start + direction;
    while (index >= 0 && index < itemsByIndex.length) {
      if (!itemsByIndex[index]?.disabled) return index;
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
      const item = itemsByIndex[selectedIndex];
      if (item && !item.disabled) onActivate?.(item as InternalMenuItemData<T>);
    },
    { enabled: keyboardEnabled }
  );

  useKeys(
    NUMBER_KEYS,
    (key) => {
      const index = parseInt(key, 10) - 1;
      const item = itemsByIndex[index];
      if (item && !item.disabled) {
        onSelect(index);
        onActivate?.(item as InternalMenuItemData<T>);
      }
    },
    { enabled: keyboardEnabled && enableNumberJump }
  );

  // Generic T provides type safety at the call site but is erased internally.
  // Context stores string values; consumers use the generic via props.
  const contextValue: MenuContextValue = useMemo(
    () => ({
      selectedIndex,
      onSelect,
      onActivate: onActivate as ((item: InternalMenuItemData) => void) | undefined,
      items,
      variant,
    }),
    [selectedIndex, onSelect, onActivate, items, variant]
  );

  return (
    <MenuContext.Provider value={contextValue}>
      <div role="listbox" aria-label={ariaLabel} className={cn("w-full relative", className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}
