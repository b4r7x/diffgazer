'use client';

import * as React from 'react';
import { useScope, useKey } from '@/hooks/keyboard';
import { DialogContext, type DialogContextValue } from './dialog-context';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = onOpenChange || setUncontrolledOpen;
  const dialogId = React.useId();

  useScope('dialog', { enabled: isOpen });
  useKey('Escape', () => handleOpenChange(false), { enabled: isOpen });

  const contextValue = React.useMemo<DialogContextValue>(
    () => ({
      open: isOpen,
      onOpenChange: handleOpenChange,
      titleId: `${dialogId}-title`,
      descriptionId: `${dialogId}-description`,
    }),
    [isOpen, handleOpenChange, dialogId]
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
}
