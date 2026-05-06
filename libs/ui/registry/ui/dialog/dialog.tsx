"use client";

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { DialogContext } from "./dialog-context";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open: controlledOpen, defaultOpen, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const dialogId = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const onTitleMount = useCallback(() => setHasTitle(true), []);
  const onTitleUnmount = useCallback(() => setHasTitle(false), []);
  const onDescriptionMount = useCallback(() => setHasDescription(true), []);
  const onDescriptionUnmount = useCallback(() => setHasDescription(false), []);

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      onOpenChange: setIsOpen,
      contentId: `${dialogId}-content`,
      titleId: `${dialogId}-title`,
      descriptionId: `${dialogId}-description`,
      hasTitle,
      hasDescription,
      onTitleMount,
      onTitleUnmount,
      onDescriptionMount,
      onDescriptionUnmount,
      triggerRef,
    }),
    [isOpen, setIsOpen, dialogId, hasTitle, hasDescription, onTitleMount, onTitleUnmount, onDescriptionMount, onDescriptionUnmount],
  );

  return (
    <DialogContext value={contextValue}>
      {children}
    </DialogContext>
  );
}
