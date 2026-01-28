'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { cn } from '../../lib/utils';

interface NavigationListContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  focusedValue?: string;
  onFocusChange?: (value: string) => void;
  itemsRef: Map<string, HTMLElement | null>;
}

const NavigationListContext = createContext<NavigationListContextType | undefined>(
  undefined
);

function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (!context) {
    throw new Error('NavigationListItem must be used within NavigationList');
  }
  return context;
}

interface NavigationListProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function NavigationList({
  value,
  onValueChange,
  children,
  className,
}: NavigationListProps) {
  const [focusedValue, setFocusedValue] = useState<string | undefined>(value);
  const itemsRef = useRef<Map<string, HTMLElement | null>>(new Map());

  useEffect(() => {
    setFocusedValue(value);
  }, [value]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    event.preventDefault();

    const items = Array.from(itemsRef.current.entries());
    const currentIndex = items.findIndex(([itemValue]) => itemValue === focusedValue);
    const nextIndex =
      event.key === 'ArrowUp'
        ? currentIndex <= 0
          ? items.length - 1
          : currentIndex - 1
        : currentIndex >= items.length - 1
          ? 0
          : currentIndex + 1;

    const nextValue = items[nextIndex]?.[0];
    if (nextValue) {
      setFocusedValue(nextValue);
      items[nextIndex][1]?.focus();
    }
  }, [focusedValue]);

  const handleFocusChange = useCallback((itemValue: string) => {
    setFocusedValue(itemValue);
  }, []);

  return (
    <NavigationListContext.Provider
      value={{
        value,
        onValueChange,
        focusedValue,
        onFocusChange: handleFocusChange,
        itemsRef: itemsRef.current,
      }}
    >
      <div
        className={cn('flex flex-col gap-1 font-mono', className)}
        onKeyDown={handleKeyDown}
        role="group"
      >
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}

interface NavigationListItemProps {
  value: string;
  label: string;
  description?: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export function NavigationListItem({
  value,
  label,
  description,
  badge,
  disabled,
}: NavigationListItemProps) {
  const context = useNavigationListContext();
  const isSelected = context.value === value;
  const isFocused = context.focusedValue === value;
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    context.itemsRef.set(value, ref.current);
    return () => {
      context.itemsRef.delete(value);
    };
  }, [value, context.itemsRef]);

  const handleClick = () => {
    if (!disabled) {
      context.onValueChange?.(value);
      context.onFocusChange?.(value);
    }
  };

  const handleFocus = () => {
    context.onFocusChange?.(value);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onFocus={handleFocus}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 px-3 py-2 text-left transition-colors cursor-pointer',
        'font-mono text-sm leading-relaxed',
        isFocused && 'bg-[--tui-blue] text-black font-bold',
        !isFocused && !disabled && 'hover:bg-[--tui-selection]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      role="radio"
      aria-checked={isSelected}
    >
      <span className="mt-0.5 flex-shrink-0 select-none">
        {isSelected ? '(x)' : '( )'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={isSelected && isFocused ? 'font-bold' : ''}>{label}</span>
          {badge && <span className="text-xs opacity-75">{badge}</span>}
        </div>
        {description && (
          <div className="text-xs opacity-60 mt-1">{description}</div>
        )}
      </div>
    </button>
  );
}
