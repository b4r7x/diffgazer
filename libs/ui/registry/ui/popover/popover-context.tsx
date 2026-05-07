"use client";

import { type RefObject, createContext, useContext } from "react";

export type PopoverTriggerMode = "click" | "hover";
export type PopoverPopupRole = "dialog" | "menu" | "listbox" | "tree" | "grid";

export interface PopoverContextValue {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  popoverId: string;
  triggerMode: PopoverTriggerMode;
  popupRole?: PopoverPopupRole;
  onOpenChange: (open: boolean) => void;
  onTriggerEnter: () => void;
  onTriggerLeave: () => void;
  onTriggerClick: () => void;
  onContentEnter: () => void;
  onContentLeave: () => void;
  enabled: boolean;
}

export const PopoverContext = createContext<PopoverContextValue | undefined>(undefined);

export function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (ctx === undefined) throw new Error("Popover parts must be used within <Popover>");
  return ctx;
}
