"use client";

import {
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { getItemState, menuItemBase, menuItemIndicator, menuItemLabel } from "./menu-item-variants";

const RADIO_SELECTED = "(*)";
const RADIO_UNSELECTED = "( )";

/** Props for menu item radio. */
export interface MenuItemRadioProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-checked" | "aria-disabled" | "data-value" | "ref"
  > {
  /** Stable identifier for the radio item. */
  id: string;
  /** Form-submission value for the radio item. */
  value: string;
  /** Disables the radio item. */
  disabled?: boolean;
  /** Radio item label. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Radio-style selectable item. */
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
  const { selectedId, highlighted, activate, highlight, idPrefix, registerItem, unregisterItem } =
    useMenuContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);

  const isSelected = !disabled && selectedId === id;
  const isFocused = highlighted === id;
  const isActive = !disabled && (isFocused || isSelected);
  const itemId = getEncodedListboxItemId(idPrefix, id);

  useLayoutEffect(() => {
    registerItem(registrationId, id, disabled, rootRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, id, disabled]);

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
      ref={composedRef}
      id={itemId}
      role="menuitemradio"
      tabIndex={-1}
      data-slot="menu-item-radio"
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-highlighted={isFocused ? "" : undefined}
      aria-checked={isSelected}
      aria-disabled={disabled || undefined}
      data-selected={isSelected ? "" : undefined}
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
