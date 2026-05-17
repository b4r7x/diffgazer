"use client";

import { useId, useMemo, useRef, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { DialogContext } from "./dialog-context";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Modal dialog root. Owns the open/closed state and ARIA wiring for its
 * compound children (`Dialog.Trigger`, `Dialog.Content`, `Dialog.Title`,
 * `Dialog.Description`, `Dialog.Body`, `Dialog.Footer`, `Dialog.Close`,
 * `Dialog.Action`). Supports both controlled and uncontrolled usage.
 *
 * @example
 * ```tsx
 * <Dialog>
 *   <Dialog.Trigger>Delete branch</Dialog.Trigger>
 *   <Dialog.Content>
 *     <Dialog.Header>
 *       <Dialog.Title>Delete branch</Dialog.Title>
 *       <Dialog.Description>This action cannot be undone.</Dialog.Description>
 *     </Dialog.Header>
 *     <Dialog.Footer>
 *       <Dialog.Close>Cancel</Dialog.Close>
 *       <Dialog.Action onClick={onDelete}>Delete</Dialog.Action>
 *     </Dialog.Footer>
 *   </Dialog.Content>
 * </Dialog>
 * ```
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <Dialog open={open} onOpenChange={setOpen}>...</Dialog>
 * ```
 */
export function Dialog({ open: controlledOpen, defaultOpen, onOpenChange, children }: DialogProps) {
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

  return (
    <DialogContext value={contextValue}>
      {children}
    </DialogContext>
  );
}
