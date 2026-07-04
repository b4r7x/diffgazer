"use client";

import { createContext, type RefObject, useContext } from "react";

/** Root - manages open state, trigger mode (click/hover), delay. */
export type PopoverTriggerMode = "click" | "hover";
/** Root - manages open state, trigger mode (click/hover), delay. */
export type PopoverPopupRole = "dialog" | "menu" | "listbox" | "tree" | "grid";

/** Context value shared by popover. */
export interface PopoverContextValue {
  /** Controlled open state. Pair with onOpenChange. */
  open: boolean;
  /** Ref for the trigger element. */
  triggerRef: RefObject<HTMLElement | null>;
  /** DOM id for popover. */
  popoverId: string;
  /** Click toggles; hover opens on pointer/focus enter with a delay and closes on leave. */
  triggerMode: PopoverTriggerMode;
  /** Overrides the auto-detected aria-haspopup value applied to the trigger. */
  popupRole?: PopoverPopupRole;
  /** Fired when the open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Called when trigger enter occurs. */
  onTriggerEnter: () => void;
  /** Called when trigger focus occurs. */
  onTriggerFocus: () => void;
  /** Called when trigger leave occurs. */
  onTriggerLeave: () => void;
  /** Called when trigger click occurs. */
  onTriggerClick: () => void;
  /** Called when trigger pointer down occurs. */
  onTriggerPointerDown: () => void;
  /** Suppresses immediate focus-open after dismissal. */
  markDismissed: () => void;
  /** Called when content enter occurs. */
  onContentEnter: () => void;
  /** Called when content leave occurs. */
  onContentLeave: () => void;
  /** When false, the popover never opens and trigger handlers are no-ops. */
  enabled: boolean;
}

/** React context backing popover. */
export const PopoverContext = createContext<PopoverContextValue | undefined>(undefined);

/** Reads the popover context. */
export function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (ctx === undefined) throw new Error("Popover parts must be used within <Popover>");
  return ctx;
}
