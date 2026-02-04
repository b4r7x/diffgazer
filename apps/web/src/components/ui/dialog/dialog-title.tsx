'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { useDialogContext } from './dialog-context';

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext();

  return (
    <h2 id={titleId} className={cn('font-bold text-sm', className)} {...props}>
      {children}
    </h2>
  );
}
