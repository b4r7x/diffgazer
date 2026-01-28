'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { useScope, useKey } from '@/hooks/keyboard';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog compound components must be used within a Dialog');
  }
  return context;
}

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = onOpenChange || setUncontrolledOpen;

  useScope('dialog');
  useKey('Escape', () => handleOpenChange(false), { enabled: isOpen });

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children, asChild, ...props }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        onOpenChange(true);
        children.props.onClick?.(e);
      },
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button
      {...props}
      onClick={(e) => {
        onOpenChange(true);
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();

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
          'bg-[--tui-bg] text-[--tui-fg]',
          'border-[6px] border-double border-[--tui-fg]',
          'shadow-[0_0_0_1px_var(--tui-border),0_30px_60px_-12px_rgba(0,0,0,0.9)]',
          className
        )}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogHeader({ children, className, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn(
        'flex justify-between items-center py-2 px-4 border-b-2 border-[--tui-border] bg-[--tui-bg] shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function DialogTitle({ children, className, id, ...props }: DialogTitleProps) {
  const { open } = useDialogContext();
  const titleId = id || 'dialog-title';

  React.useEffect(() => {
    if (open && titleId) {
      const dialogElement = document.querySelector('[role="dialog"]');
      if (dialogElement && !dialogElement.getAttribute('aria-labelledby')) {
        dialogElement.setAttribute('aria-labelledby', titleId);
      }
    }
  }, [open, titleId]);

  return (
    <h2 id={titleId} className={cn('font-bold text-sm', className)} {...props}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  return (
    <div
      className={cn('text-xs text-[--tui-fg]/70', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
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

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex gap-2 justify-end items-center py-2 px-4 border-t-2 border-[--tui-border] bg-[--tui-bg] shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  asChild?: boolean;
}

export function DialogClose({ children, asChild, ...props }: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        onOpenChange(false);
        children.props.onClick?.(e);
      },
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button
      {...props}
      onClick={(e) => {
        onOpenChange(false);
        props.onClick?.(e);
      }}
    >
      {children || '[x]'}
    </button>
  );
}
