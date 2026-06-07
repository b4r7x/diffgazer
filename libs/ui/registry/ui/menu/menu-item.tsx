"use client";

import type { ComponentPropsWithRef, FocusEvent, MouseEvent, ReactNode, Ref } from "react";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { DefaultItemLayout, HubItemLayout } from "./menu-item-layouts";
import { getItemState, menuItemBase, menuItemValue } from "./menu-item-variants";

export interface MenuItemProps<TId extends string = string>
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-checked" | "aria-disabled" | "data-value" | "ref"
  > {
  id: TId;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: number | string;
  icon?: ReactNode;
  value?: ReactNode;
  valueVariant?: "default" | "success" | "success-badge" | "muted";
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

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
  } = useMenuContext();

  const isSelected = !disabled && selectedId === id;
  const isFocused = highlighted === id;
  const isActive = !disabled && (isFocused || isSelected);
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";
  const state = getItemState({ disabled, isFocused, isSelected });
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: menuitem with centralized keyboard handling — the menu container owns arrow/Enter/Space via useNavigation; the item only mirrors focus/click.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is the dynamic itemRole (menuitem/menuitemradio) that Biome cannot resolve; aria-checked is valid for menuitemradio.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space activation is handled centrally by the menu container, not per item.
    <div
      {...rootProps}
      ref={ref}
      id={itemId}
      role={itemRole}
      tabIndex={-1}
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-active={isActive || undefined}
      data-focus={isFocused || undefined}
      aria-checked={itemRole === "menuitemradio" ? isSelected : undefined}
      aria-disabled={disabled || undefined}
      data-state={isSelected ? "selected" : "unselected"}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(menuItemBase({ menuVariant, state, colorVariant: variant }), className)}
    >
      {isHub ? (
        <HubItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          value={value}
          valueClassName={menuItemValue({ valueVariant, focused: isActive, active: isActive })}
          icon={icon}
        >
          {children}
        </HubItemLayout>
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
