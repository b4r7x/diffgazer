"use client";

import { createContext, type ReactNode, useContext } from "react";

export type CustomActivator = () => void;

/** The submenu currently replacing the item list in drill-down (`stack`) mode. */
export interface MenuSubEntry {
  /** Sub-trigger item id, so popping can restore the highlight to it. */
  id: string;
  /** Trigger label, echoed in the back row so the parent context stays legible. */
  label: ReactNode;
}

/** Context value shared by menu. */
export interface MenuContextValue {
  /**
   * Controlled selected item id. Pair with onSelect. Switches item role to "menuitemradio" with
   * aria-checked.
   */
  selectedId: string | null;
  /** Controlled highlighted (focused) item id. Pair with onHighlightChange. */
  highlighted: string | null;
  /** Activates an item in menu. */
  activate: (id: string) => void;
  /** Notifies the owning root menu when a nested menu item is activated. */
  notifySelect: (id: string) => void;
  /** Highlights an item in menu. */
  highlight: (id: string) => void;
  /**
   * Visual layout. `detail` renders taller, divider-separated rows with a right-aligned value
   * column, for menus where each item carries a status or summary value.
   */
  variant: "default" | "detail";
  idPrefix: string;
  itemRole: "menuitem" | "menuitemradio";
  /** Registers item with menu. */
  registerItem: (
    registrationId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from menu. */
  unregisterItem: (registrationId: string) => void;
  /** Registers activator with menu. */
  registerActivator: (id: string, handler: CustomActivator) => void;
  /** Unregisters activator from menu. */
  unregisterActivator: (id: string) => void;
  /** Submenu currently drilled into, or null at the root level. */
  activeSub: MenuSubEntry | null;
  /** Replaces the item list with a submenu. One level; a sibling push replaces. */
  pushSub: (entry: MenuSubEntry) => void;
  /**
   * Returns to the parent item list and restores the highlight to the trigger.
   * Pass an entry id to pop only that entry, so a submenu tearing down after a
   * sibling already pushed does not clobber the sibling.
   */
  popSub: (id?: string) => void;
  /** Element a stacked submenu portals its items into, or null while at the root. */
  stackContainer: HTMLElement | null;
}

/** React context backing menu. */
export const MenuContext = createContext<MenuContextValue | undefined>(undefined);

/** Reads the menu context. */
export function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error("Menu parts must be used within a Menu");
  }
  return context;
}
