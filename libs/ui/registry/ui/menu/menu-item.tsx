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

/** Colour treatment for a detail value. */
type MenuItemValueVariant = "default" | "success" | "success-badge" | "muted";

/**
 * Glyph prepended to a detail value. Only the success variants get one, and it is the
 * non-color carrier of "passing" in a monochrome palette — informative, not decorative,
 * so it stays in the accessibility tree.
 */
const MENU_VALUE_GLYPHS: Partial<Record<MenuItemValueVariant, string>> = {
  success: "✓",
  "success-badge": "✓",
};

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
   * Leading icon rendered in the indicator slot. Replaces the default ▌ cursor and hover
   * chevron when provided.
   */
  icon?: ReactNode;
  /** Detail variant only. Right-aligned value (badge, count, or status text). */
  value?: ReactNode;
  /**
   * Color treatment for the detail value. The success variants prefix a ✓ so the passing
   * state does not rest on color alone.
   */
  valueVariant?: MenuItemValueVariant;
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
  onPointerMove,
  onPointerLeave,
  ...rootProps
}: MenuItemProps<TId>) {
  const {
    selectedId,
    highlighted,
    hoveredId,
    activate,
    highlight,
    hover,
    unhover,
    trackPointer,
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
  const state = getItemState({ disabled, isFocused, isSelected, isHovered: hoveredId === id });
  // Post-precedence: a row that is both hovered and keyboard-highlighted renders
  // the keyboard treatment, so hover visuals exist only in the "hovered" state.
  const isHovered = state === "hovered";
  const itemId = getEncodedListboxItemId(idPrefix, id);

  const { handleClick, handleFocus, handleMouseDown, handlePointerMove, handlePointerLeave } =
    useMenuItemInteractions({
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
      data-hovered={isHovered ? "" : undefined}
      aria-checked={itemRole === "menuitemradio" ? isSelected : undefined}
      aria-disabled={disabled || undefined}
      data-selected={isSelected ? "" : undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(menuItemBase({ menuVariant, state, colorVariant: variant }), className)}
    >
      {isDetail ? (
        <DetailItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          isHovered={isHovered}
          value={value}
          valueClassName={menuItemValue({ valueVariant, active: isActive })}
          valueGlyph={MENU_VALUE_GLYPHS[valueVariant]}
          icon={icon}
        >
          {children}
        </DetailItemLayout>
      ) : (
        <DefaultItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          isHovered={isHovered}
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
