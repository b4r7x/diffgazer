'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void;
  getTriggers: () => Map<string, HTMLButtonElement | null>;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs');
  }
  return context;
}

interface TabsProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

function Tabs({
  value: controlledValue,
  onValueChange,
  defaultValue = '',
  children,
  className,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const triggersRef = React.useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleValueChange = onValueChange || setUncontrolledValue;

  const registerTrigger = React.useCallback(
    (triggerValue: string, element: HTMLButtonElement | null) => {
      if (element) {
        triggersRef.current.set(triggerValue, element);
      } else {
        triggersRef.current.delete(triggerValue);
      }
    },
    []
  );

  const getTriggers = React.useCallback(() => triggersRef.current, []);

  return (
    <TabsContext.Provider
      value={{ value, onValueChange: handleValueChange, registerTrigger, getTriggers }}
    >
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

function TabsList({ children, className }: TabsListProps) {
  const { value, onValueChange, getTriggers } = useTabsContext();

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();

      const triggers = getTriggers();
      const items = Array.from(triggers.entries());
      const currentIndex = items.findIndex(([itemValue]) => itemValue === value);

      const nextIndex =
        event.key === 'ArrowLeft'
          ? currentIndex <= 0
            ? items.length - 1
            : currentIndex - 1
          : currentIndex >= items.length - 1
            ? 0
            : currentIndex + 1;

      const nextItem = items[nextIndex];
      if (nextItem) {
        onValueChange(nextItem[0]);
        nextItem[1]?.focus();
      }
    },
    [value, onValueChange, getTriggers]
  );

  return (
    <div
      className={cn('flex gap-1 font-mono', className)}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function TabsTrigger({ value, children, className, disabled }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, registerTrigger } = useTabsContext();
  const ref = React.useRef<HTMLButtonElement>(null);
  const isActive = selectedValue === value;

  React.useEffect(() => {
    registerTrigger(value, ref.current);
    return () => registerTrigger(value, null);
  }, [value, registerTrigger]);

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onValueChange(value);
        }
      }}
      className={cn(
        'px-3 py-1 text-sm font-mono transition-colors cursor-pointer',
        'border border-[--tui-border]',
        'focus:outline-none focus:ring-1 focus:ring-[--tui-primary]',
        isActive && 'bg-blue-600 text-white border-blue-600',
        !isActive && !disabled && 'bg-[--tui-bg] text-[--tui-fg] hover:bg-[--tui-selection]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();

  if (selectedValue !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={cn('mt-2', className)}
    >
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
