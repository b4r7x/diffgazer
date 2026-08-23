"use client";

import { createContext, type RefObject, useContext } from "react";

export type PopoverTriggerMode = "click" | "hover";
export type PopoverPopupRole = "dialog" | "menu" | "listbox" | "tree" | "grid";

export interface PopoverContextValue {
  /** Controlled open state. Pair with onOpenChange. */
  open: boolean;
  /** Ref for the trigger element. */
  triggerRef: RefObject<HTMLElement | null>;
  /** DOM id for popover. */
  popoverId: string;
  /** Click toggles; hover delays pointer-open, keyboard focus opens immediately, and leave closes. */
  triggerMode: PopoverTriggerMode;
  /** Overrides the auto-detected aria-haspopup value applied to the trigger. */
  popupRole?: PopoverPopupRole;
  /** Fired when the open state changes. */
  onOpenChange: (open: boolean) => void;
  onTriggerEnter: () => void;
  onTriggerFocus: () => void;
  onTriggerLeave: () => void;
  onTriggerBlur: () => void;
  onTriggerClick: () => void;
  onTriggerPointerDown: () => void;
  /** Suppresses immediate focus-open after dismissal. */
  markDismissed: () => void;
  onContentEnter: () => void;
  onContentLeave: () => void;
  /** When false, the popover never opens and trigger handlers are no-ops. */
  enabled: boolean;
}

export const PopoverContext = createContext<PopoverContextValue | undefined>(undefined);

export function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (ctx === undefined) throw new Error("Popover parts must be used within <Popover>");
  return ctx;
}
