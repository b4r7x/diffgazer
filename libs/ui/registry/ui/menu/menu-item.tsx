"use client";

import {
  type ComponentPropsWithRef,
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
import { DefaultItemLayout, DetailItemLayout } from "./menu-item-layouts";
import { getItemState, menuItemBase, menuItemValue } from "./menu-item-variants";
import { useMenuItemInteractions } from "./use-menu-item-interactions";

/** Props for menu item. */
export interface MenuItemProps<TId extends string = string>
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-checked" | "aria-disabled" | "data-value" | "ref"
  > {
  /** Stable identifier matched against selectedId/highlighted and passed to onSelect. */
  id: TId;
  /** Disables activation while keeping the item in the navigation order with aria-disabled. */
  disabled?: boolean;
  /** Danger applies destructive coloring for destructive actions. */
  variant?: "default" | "danger";
  /** Decorative hotkey label rendered as [n]. Does not bind a key listener. */
  hotkey?: number | string;
  /**
   * Leading icon rendered in the indicator slot. Replaces the default ▐/> indicator when
   * provided.
   */
  icon?: ReactNode;
  /** Detail variant only. Right-aligned value (badge, count, or status text). */
  value?: ReactNode;
  /** Color treatment for the detail value. */
  valueVariant?: "default" | "success" | "success-badge" | "muted";
  /** Item label. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Selectable item with optional hotkey, value, variant. */
export function MenuItem<TId extends string = string>({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  icon,
  value,
  valueVariant = "default",
  children,
  className,
  ref,
  onClick,
  onFocus,
  onMouseDown,
  ...rootProps
}: MenuItemProps<TId>) {
  const {
    selectedId,
    highlighted,
    activate,
    highlight,
    variant: menuVariant,
    idPrefix,
    itemRole,
    registerItem,
    unregisterItem,
  } = useMenuContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);

  useLayoutEffect(() => {
    registerItem(registrationId, id, disabled, rootRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, id, disabled]);

  const isSelected = !disabled && selectedId === id;
  const isFocused = highlighted === id;
  const isActive = !disabled && (isFocused || isSelected);
  const isDanger = variant === "danger";
  const isDetail = menuVariant === "detail";
  const state = getItemState({ disabled, isFocused, isSelected });
  const itemId = getEncodedListboxItemId(idPrefix, id);

  const { handleClick, handleFocus, handleMouseDown } = useMenuItemInteractions({
    id,
    disabled,
    activate,
    highlight,
    onClick,
    onFocus,
    onMouseDown,
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menuitem with centralized keyboard handling — the menu container owns arrow/Enter/Space via useNavigation; the item only mirrors focus/click.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is the dynamic itemRole (menuitem/menuitemradio) that Biome cannot resolve; aria-checked is valid for menuitemradio.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space activation is handled centrally by the menu container, not per item.
    <div
      {...rootProps}
      ref={composedRef}
      id={itemId}
      role={itemRole}
      tabIndex={-1}
      data-slot="menu-item"
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-highlighted={isFocused ? "" : undefined}
      aria-checked={itemRole === "menuitemradio" ? isSelected : undefined}
      aria-disabled={disabled || undefined}
      data-selected={isSelected ? "" : undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(menuItemBase({ menuVariant, state, colorVariant: variant }), className)}
    >
      {isDetail ? (
        <DetailItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          value={value}
          valueClassName={menuItemValue({ valueVariant, focused: isActive, active: isActive })}
          icon={icon}
        >
          {children}
        </DetailItemLayout>
      ) : (
        <DefaultItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          isDanger={isDanger}
          hotkey={hotkey}
          icon={icon}
        >
          {children}
        </DefaultItemLayout>
      )}
    </div>
  );
}
