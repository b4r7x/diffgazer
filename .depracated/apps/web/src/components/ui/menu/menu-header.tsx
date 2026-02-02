'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface MenuHeaderProps {
  children: ReactNode;
  className?: string;
}

export function MenuHeader({ children, className }: MenuHeaderProps) {
  return (
    <div className={cn('absolute -top-3 left-4', className)}>
      <span className="inline-block border border-tui-blue bg-tui-bg px-2 py-0.5 text-tui-blue font-bold text-xs uppercase tracking-wider">
        {children}
      </span>
    </div>
  );
}
