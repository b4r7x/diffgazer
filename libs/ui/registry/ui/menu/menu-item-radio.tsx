"use client";

import type { ComponentPropsWithRef, FocusEvent, MouseEvent, ReactNode, Ref } from "react";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { getItemState, menuItemBase, menuItemIndicator, menuItemLabel } from "./menu-item-variants";

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
  const { selectedId, highlighted, activate, highlight, idPrefix } = useMenuContext();

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

  const state = getItemState({ disabled, isFocused, isSelected });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space selection is handled centrally by the menu container via useNavigation, not per item.
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
      className={cn(
        menuItemBase({ menuVariant: "default", state, colorVariant: "default" }),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={menuItemIndicator({ idle: (!isActive && !disabled) || undefined })}
      >
        {isSelected ? RADIO_SELECTED : RADIO_UNSELECTED}
      </span>
      <span className={menuItemLabel({ idle: (!isActive && !disabled) || undefined })}>
        {children}
      </span>
    </div>
  );
}
