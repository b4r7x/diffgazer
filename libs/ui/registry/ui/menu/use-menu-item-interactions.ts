"use client";

import type { FocusEventHandler, MouseEventHandler, PointerEventHandler } from "react";

interface UseMenuItemInteractionsOptions<E extends HTMLElement> {
  id: string;
  disabled: boolean;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  hover: (id: string) => void;
  unhover: (id: string) => void;
  trackPointer: (x: number, y: number) => boolean;
  onClick?: MouseEventHandler<E>;
  onFocus?: FocusEventHandler<E>;
  onMouseDown?: MouseEventHandler<E>;
  onPointerMove?: PointerEventHandler<E>;
  onPointerLeave?: PointerEventHandler<E>;
}

/**
 * Two independent states: the keyboard cursor (highlight, in aria-activedescendant)
 * and the cosmetic hover. The pointer only ever touches hover — clicking commits by
 * activating, which moves the cursor; travelling never does.
 */
export function useMenuItemInteractions<E extends HTMLElement = HTMLDivElement>({
  id,
  disabled,
  activate,
  highlight,
  hover,
  unhover,
  trackPointer,
  onClick,
  onFocus,
  onMouseDown,
  onPointerMove,
  onPointerLeave,
}: UseMenuItemInteractionsOptions<E>) {
  const handleClick: MouseEventHandler<E> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    activate(id);
  };

  const handleFocus: FocusEventHandler<E> = (event) => {
    onFocus?.(event);
    if (event.defaultPrevented || disabled) return;
    highlight(id);
  };

  const handleMouseDown: MouseEventHandler<E> = (event) => {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if (disabled) event.preventDefault();
  };

  const handlePointerMove: PointerEventHandler<E> = (event) => {
    onPointerMove?.(event);
    // Record unconditionally: even a disabled or defaultPrevented row keeps the
    // menu-wide last-known pointer position honest for the next row.
    const moved = trackPointer(event.clientX, event.clientY);
    if (event.defaultPrevented || disabled || !moved) return;
    hover(id);
  };

  const handlePointerLeave: PointerEventHandler<E> = (event) => {
    onPointerLeave?.(event);
    unhover(id);
  };

  return { handleClick, handleFocus, handleMouseDown, handlePointerMove, handlePointerLeave };
}
