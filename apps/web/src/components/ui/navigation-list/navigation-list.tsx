import { useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useGroupNavigation } from '@/hooks/keyboard';
import { NavigationListContext } from './navigation-list-context';

export interface NavigationListRootProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  keyboardEnabled?: boolean;
  isFocused?: boolean;
  className?: string;
  children: ReactNode;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function NavigationList({
  selectedId,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  isFocused = true,
  className,
  children,
  onBoundaryReached,
}: NavigationListRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGroupNavigation({
    containerRef,
    role: 'option',
    value: selectedId,
    onValueChange: onSelect,
    onEnter: onActivate,
    enabled: keyboardEnabled,
    wrap: false,
    onBoundaryReached,
  });

  const contextValue = { selectedId, onSelect, onActivate, isFocused };

  return (
    <NavigationListContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="listbox"
        aria-activedescendant={selectedId ? `navlist-${selectedId}` : undefined}
        className={cn('w-full', className)}
      >
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}
