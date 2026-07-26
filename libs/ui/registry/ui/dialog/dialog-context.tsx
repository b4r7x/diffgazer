"use client";

import { createContext, type MouseEventHandler, type RefObject, useContext } from "react";

/** Context value shared by dialog. */
export interface DialogContextValue {
  /** Controlled open state. Pair with onOpenChange. */
  open: boolean;
  /**
   * Called whenever open state changes (trigger click, Escape, backdrop click, programmatic
   * close).
   */
  onOpenChange: (open: boolean) => void;
  /** DOM id for content. */
  contentId: string;
  /** DOM id for title. */
  titleId: string;
  /** DOM id for description. */
  descriptionId: string;
  /** Ref for the trigger element. */
  triggerRef: RefObject<HTMLElement | null>;
  /** Whether dialog has registered title. */
  hasRegisteredTitle: boolean;
  /** Whether dialog has registered description. */
  hasRegisteredDescription: boolean;
  /** Registers title with dialog. */
  registerTitle: (registrationId: string) => void;
  /** Unregisters title from dialog. */
  unregisterTitle: (registrationId: string) => void;
  /** Registers description with dialog. */
  registerDescription: (registrationId: string) => void;
  /** Unregisters description from dialog. */
  unregisterDescription: (registrationId: string) => void;
}

export const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog compound components must be used within a Dialog");
  }
  return context;
}

export function useDialogDismiss<T extends HTMLElement = HTMLElement>(
  onClick?: MouseEventHandler<T>,
): MouseEventHandler<T> {
  const { onOpenChange } = useDialogContext();
  return (e) => {
    onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(false);
  };
}
