import { useState, type ReactNode, type KeyboardEvent, type Ref } from "react";
import { cn } from "../../lib/cn";
import { MenuContext, type MenuContextValue } from "./menu-context";

export interface MenuProps {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  focusedValue?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  variant?: "default" | "hub";
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent) => void;
  ref?: Ref<HTMLDivElement>;
}

export function Menu({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  focusedValue = null,
  onSelect,
  onActivate,
  variant = "default",
  className,
  "aria-label": ariaLabel,
  children,
  onKeyDown,
  ref,
}: MenuProps) {
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(defaultSelectedId);

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledId;
  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    else setUncontrolledId(id);
  };

  const activeDescendant = selectedId ? `menu-item-${selectedId}` : undefined;

  const contextValue: MenuContextValue = {
    selectedId,
    focusedValue,
    onSelect: handleSelect,
    onActivate,
    variant,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <div
        ref={ref}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={activeDescendant}
        tabIndex={0}
        className={cn("w-full relative outline-none", className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}
