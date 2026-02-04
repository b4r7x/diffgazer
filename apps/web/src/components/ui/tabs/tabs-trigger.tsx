'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { useTabsContext } from './tabs-context';

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function TabsTrigger({ value, children, className, disabled }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, registerTrigger } = useTabsContext();
  const ref = React.useRef<HTMLButtonElement>(null);
  const isActive = selectedValue === value;

  React.useEffect(() => {
    registerTrigger(value, ref.current);
    return () => registerTrigger(value, null);
  }, [value, registerTrigger]);

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      onValueChange(value);
    }
  }, [disabled, onValueChange, value]);

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
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
