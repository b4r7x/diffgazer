'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { useTabsContext } from './tabs-context';

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
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
