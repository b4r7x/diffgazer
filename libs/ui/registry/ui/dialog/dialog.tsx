"use client";

import { type ReactNode, useId, useMemo, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { DialogContext } from "./dialog-context";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

function DialogRoot({ open: controlledOpen, defaultOpen, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const dialogId = useId();
  const triggerRef = useRef<HTMLElement>(null);

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      onOpenChange: setIsOpen,
      contentId: `${dialogId}-content`,
      titleId: `${dialogId}-title`,
      descriptionId: `${dialogId}-description`,
      triggerRef,
    }),
    [isOpen, setIsOpen, dialogId],
  );

  return <DialogContext value={contextValue}>{children}</DialogContext>;
}

export { DialogRoot as Dialog };
