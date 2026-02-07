import { useContext, useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { KeyboardContext } from "@stargazer/keyboard";
import { cn } from "../../lib/cn";
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
}: MenuProps<T>) {
  const keyboardContext = useContext(KeyboardContext);
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

  const activeScope = keyboardContext?.activeScope ?? null;
  const hasScopedKeyboard = keyboardEnabled && !!activeScope;

  useEffect(() => {
    if (!hasScopedKeyboard || !keyboardContext || !activeScope) return;

    const cleanups: Array<() => void> = [
      keyboardContext.register(activeScope, "ArrowUp", selectPrevious),
      keyboardContext.register(activeScope, "ArrowDown", selectNext),
      keyboardContext.register(activeScope, "Enter", activateSelected),
    ];

    if (enableNumberJump) {
      NUMBER_KEYS.forEach((key, idx) => {
        cleanups.push(
          keyboardContext.register(activeScope, key, () => selectByNumber(idx))
        );
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    activeScope,
    hasScopedKeyboard,
    keyboardContext,
    enableNumberJump,
    selectedIndex,
  ]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!keyboardEnabled) return;
    // Scoped keyboard already handles these globally.
    if (hasScopedKeyboard) return;

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
    items: itemsRef.current,
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
