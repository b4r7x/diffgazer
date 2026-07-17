"use client";

import type { FocusEventHandler, MouseEventHandler } from "react";

interface UseMenuItemInteractionsOptions {
  id: string;
  disabled: boolean;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onFocus?: FocusEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
}

export function useMenuItemInteractions({
  id,
  disabled,
  activate,
  highlight,
  onClick,
  onFocus,
  onMouseDown,
}: UseMenuItemInteractionsOptions) {
  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    activate(id);
  };

  const handleFocus: FocusEventHandler<HTMLDivElement> = (event) => {
    onFocus?.(event);
    if (event.defaultPrevented || disabled) return;
    highlight(id);
  };

  const handleMouseDown: MouseEventHandler<HTMLDivElement> = (event) => {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if (disabled) event.preventDefault();
  };

  return { handleClick, handleFocus, handleMouseDown };
}
