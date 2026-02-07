import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/cn";
import { useLocalNavigation, type NavigableHandle } from "../../internal/use-local-navigation";
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
  ref?: Ref<NavigableHandle>;
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
  ref,
}: NavigationListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(defaultSelectedId);

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledId;
  const handleSelect = (id: string) => {
    if (onSelect) onSelect(id);
    else setUncontrolledId(id);
  };

  const { onKeyDown, handle } = useLocalNavigation({
    containerRef,
    role: "option",
    value: selectedId,
    onValueChange: handleSelect,
    onEnter: (value) => onActivate?.(value),
    wrap: false,
    onBoundaryReached,
    enabled: keyboardEnabled,
    initialValue: defaultSelectedId,
  });

  useImperativeHandle(ref, () => handle);

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
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}
