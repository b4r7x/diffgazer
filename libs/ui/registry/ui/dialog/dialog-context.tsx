"use client";

import { createContext, useContext, type RefObject, type MouseEventHandler } from "react";

export interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  onTitleMount: () => void;
  onTitleUnmount: () => void;
  onDescriptionMount: () => void;
  onDescriptionUnmount: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}

export const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog compound components must be used within a Dialog");
  }
  return context;
}

export function useDialogDismiss<T extends HTMLElement = HTMLElement>(onClick?: MouseEventHandler<T>): MouseEventHandler<T> {
  const { onOpenChange } = useDialogContext();
  return (e) => {
    onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(false);
  };
}
