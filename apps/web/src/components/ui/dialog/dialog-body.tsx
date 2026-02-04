'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogBody({ children, className, ...props }: DialogBodyProps) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto px-4 py-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}
