'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { useTabsContext } from './tabs-context';

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  const { value, onValueChange, getTriggers } = useTabsContext();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();

    const triggers = getTriggers();
    const items = Array.from(triggers.entries());
    const currentIndex = items.findIndex(([itemValue]) => itemValue === value);

    let nextIndex: number;
    if (event.key === 'ArrowLeft') {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    }

    const nextItem = items[nextIndex];
    if (nextItem) {
      onValueChange(nextItem[0]);
      nextItem[1]?.focus();
    }
  };

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
