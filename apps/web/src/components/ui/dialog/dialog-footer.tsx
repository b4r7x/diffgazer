'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex gap-2 justify-end items-center py-2 px-4 border-t-2 border-tui-border bg-tui-bg shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
