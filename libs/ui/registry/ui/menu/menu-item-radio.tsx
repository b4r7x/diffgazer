"use client";

import type {
  ComponentPropsWithRef,
  FocusEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from "react";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { MENU_ITEM_BASE_CLASS, useMenuContext } from "./menu-context";

const RADIO_SELECTED = "(*)";
const RADIO_UNSELECTED = "( )";

export interface MenuItemRadioProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-checked" | "aria-disabled" | "data-value" | "ref"
  > {
  id: string;
  value: string;
  disabled?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function MenuItemRadio({
  id,
  value,
  disabled = false,
  children,
  className,
  ref,
  onClick,
  onFocus,
  onMouseDown,
  ...rootProps
}: MenuItemRadioProps) {
  const { selectedId, highlighted, activate, highlight, idPrefix } =
    useMenuContext();

  const isSelected = !disabled && selectedId === id;
  const isFocused = highlighted === id;
  const isActive = !disabled && (isFocused || isSelected);
  const itemId = getEncodedListboxItemId(idPrefix, id);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    activate(id);
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (event.defaultPrevented || disabled) return;
    highlight(id);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if (disabled) event.preventDefault();
  };

  const stateClass = disabled
    ? isFocused
      ? "opacity-60 cursor-not-allowed bg-secondary text-foreground"
      : "opacity-50 cursor-not-allowed hover:bg-transparent"
    : isFocused
      ? "bg-primary text-primary-foreground font-bold"
      : isSelected
        ? "bg-primary text-primary-foreground font-bold group"
        : "hover:bg-secondary group";

  return (
    <div
      {...rootProps}
      ref={ref}
      id={itemId}
      role="menuitemradio"
      tabIndex={-1}
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-active={isActive || undefined}
      data-focus={isFocused || undefined}
      aria-checked={isSelected}
      aria-disabled={disabled || undefined}
      data-state={isSelected ? "selected" : "unselected"}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(MENU_ITEM_BASE_CLASS, stateClass, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pr-4 shrink-0 inline-flex items-center justify-center self-center leading-none font-mono text-xs",
          !isActive && !disabled && "transition-opacity opacity-60 group-hover:opacity-100",
        )}
      >
        {isSelected ? RADIO_SELECTED : RADIO_UNSELECTED}
      </span>
      <span className={cn("tracking-wide", !isActive && !disabled && "group-hover:text-foreground")}>
        {children}
      </span>
    </div>
  );
}
