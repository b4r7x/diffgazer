"use client";

import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { DialogContext } from "./dialog-context";

/** Props for dialog. */
export interface DialogProps {
  /** Controlled open state. Pair with onOpenChange. */
  open?: boolean;
  /** Initial open state for uncontrolled usage. */
  defaultOpen?: boolean;
  /**
   * Called whenever open state changes (trigger click, Escape, backdrop click, programmatic
   * close).
   */
  onOpenChange?: (open: boolean) => void;
  /** Content rendered inside the component. */
  children: ReactNode;
}

function useIdSetRegistry() {
  const [ids, setIds] = useState<readonly string[]>([]);
  const register = useCallback((id: string) => {
    setIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);
  const unregister = useCallback((id: string) => {
    setIds((current) => current.filter((existing) => existing !== id));
  }, []);
  return [ids.length > 0, register, unregister] as const;
}

/**
 * Modal dialog with compound component architecture. Built on the native dialog element with
 * two orthogonal visual axes: frame (border or none) and corners (none, subtle, standard, bold,
 * or outset), and an optional header marker bar spanning the title and description.
 */
function DialogRoot({ open: controlledOpen, defaultOpen, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const dialogId = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const [hasRegisteredTitle, registerTitle, unregisterTitle] = useIdSetRegistry();
  const [hasRegisteredDescription, registerDescription, unregisterDescription] = useIdSetRegistry();

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      onOpenChange: setIsOpen,
      contentId: `${dialogId}-content`,
      titleId: `${dialogId}-title`,
      descriptionId: `${dialogId}-description`,
      triggerRef,
      hasRegisteredTitle,
      hasRegisteredDescription,
      registerTitle,
      unregisterTitle,
      registerDescription,
      unregisterDescription,
    }),
    [
      isOpen,
      setIsOpen,
      dialogId,
      hasRegisteredTitle,
      hasRegisteredDescription,
      registerTitle,
      unregisterTitle,
      registerDescription,
      unregisterDescription,
    ],
  );

  return <DialogContext value={contextValue}>{children}</DialogContext>;
}

export { DialogRoot as Dialog };
