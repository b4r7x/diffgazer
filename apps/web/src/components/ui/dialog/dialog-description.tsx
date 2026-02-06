'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { useDialogContext } from './dialog-context';

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();

  return (
    <div
      id={descriptionId}
      className={cn('text-xs text-tui-fg/70', className)}
      {...props}
    >
      {children}
    </div>
  );
}
