'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { useDialogContext } from './dialog-context';

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[90vh] flex flex-col',
          'bg-tui-bg text-tui-fg',
          'border-[6px] border-double border-tui-fg',
          'shadow-[0_0_0_1px_rgb(48_54_61),0_30px_60px_-12px_rgba(0,0,0,0.9)]',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
