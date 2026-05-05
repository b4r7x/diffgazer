"use client";

import { useId, useMemo, useRef, useState, useEffectEvent, type ReactNode } from "react";
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
  const [hasDescription, setHasDescription] = useState(false);
  const onDescriptionMount = useEffectEvent(() => setHasDescription(true));
  const onDescriptionUnmount = useEffectEvent(() => setHasDescription(false));

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      onOpenChange: setIsOpen,
      contentId: `${dialogId}-content`,
      titleId: `${dialogId}-title`,
      descriptionId: `${dialogId}-description`,
      hasDescription,
      onDescriptionMount,
      onDescriptionUnmount,
      triggerRef,
    }),
    [isOpen, dialogId, hasDescription],
  );

  return (
    <DialogContext value={contextValue}>
      {children}
    </DialogContext>
  );
}
