"use client";

import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { getItemState, menuItemBase } from "./menu-item-variants";
import { useMenuItemInteractions } from "./use-menu-item-interactions";

/** Reserved item id for the drill-down back row. */
export const MENU_STACK_BACK_ID = "__menu-stack-back";

interface MenuStackBackProps {
  /** Parent trigger label echoed in the row. */
  label: ReactNode;
}

/**
 * Sticky first row of a drilled-down submenu: the breadcrumb and the pop
 * control in one. It is a real button registered like any other menu item, so
 * roving focus, `aria-activedescendant`, and ArrowDown-wrapping reach it with no
 * special-casing, and it is a compliant touch target.
 */
export function MenuStackBack({ label }: MenuStackBackProps) {
  const {
    highlighted,
    hoveredId,
    highlight,
    hover,
    unhover,
    trackPointer,
    idPrefix,
    registerItem,
    unregisterItem,
    registerActivator,
    unregisterActivator,
    popSub,
  } = useMenuContext();
  const registrationId = useId();
  const rowRef = useRef<HTMLButtonElement>(null);
  // Wrapped: popSub takes an optional entry id, and a bare handler reference
  // would hand it the click event instead.
  const pop = useCallback(() => popSub(), [popSub]);

  const isFocused = highlighted === MENU_STACK_BACK_ID;
  const state = getItemState({
    disabled: false,
    isFocused,
    isSelected: false,
    isHovered: hoveredId === MENU_STACK_BACK_ID,
  });
  const isHovered = state === "hovered";

  const { handleClick, handleFocus, handleMouseDown, handlePointerMove, handlePointerLeave } =
    useMenuItemInteractions<HTMLButtonElement>({
      id: MENU_STACK_BACK_ID,
      disabled: false,
      activate: pop,
      highlight,
      hover,
      unhover,
      trackPointer,
    });

  useLayoutEffect(() => {
    registerItem(registrationId, MENU_STACK_BACK_ID, false, rowRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId]);

  useEffect(() => {
    registerActivator(MENU_STACK_BACK_ID, pop);
    return () => unregisterActivator(MENU_STACK_BACK_ID);
  }, [registerActivator, unregisterActivator, pop]);

  return (
    <button
      ref={rowRef}
      type="button"
      id={getEncodedListboxItemId(idPrefix, MENU_STACK_BACK_ID)}
      // APG: the back row is a command inside the same menu, never a radio, so
      // the role is pinned rather than inherited from the menu-wide itemRole.
      role="menuitem"
      tabIndex={-1}
      data-slot="menu-stack-back"
      data-diffgazer-navigation-item="true"
      data-value={MENU_STACK_BACK_ID}
      data-highlighted={isFocused ? "" : undefined}
      data-hovered={isHovered ? "" : undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        menuItemBase({ menuVariant: "default", state }),
        "min-h-11 gap-2 border-b border-border text-left",
        isFocused ? "" : "text-muted-foreground",
      )}
    >
      <span aria-hidden="true">‹</span>
      {/* The label is arbitrary JSX, so the accessible name is composed from a
          visually-hidden prefix rather than a stringified aria-label. */}
      <span className="sr-only">Back to</span> <span>{label}</span>
    </button>
  );
}
