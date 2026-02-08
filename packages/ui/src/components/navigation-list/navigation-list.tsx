import { useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/cn";
import { NavigationListContext } from "./navigation-list-context";

export interface NavigationListProps {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  focusedValue?: string | null;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
  isFocused?: boolean;
  className?: string;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent) => void;
  "aria-label"?: string;
  ref?: Ref<HTMLDivElement>;
}

export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  focusedValue = null,
  onSelect,
  onActivate,
  isFocused = true,
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  ref,
}: NavigationListProps) {
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(defaultSelectedId);

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledId;
  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    else setUncontrolledId(id);
  };

  const contextValue = { selectedId, focusedValue, onSelect: handleSelect, onActivate, isFocused };

  return (
    <NavigationListContext.Provider value={contextValue}>
      <div
        ref={ref}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={selectedId ? `navlist-${selectedId}` : undefined}
        className={cn("w-full outline-none", className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}
