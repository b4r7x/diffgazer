"use client";

import {
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { getItemState, menuItemBase, menuItemIndicator, menuItemLabel } from "./menu-item-variants";

const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";

export interface MenuItemCheckboxProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    | "id"
    | "children"
    | "role"
    | "aria-checked"
    | "aria-disabled"
    | "data-value"
    | "onChange"
    | "ref"
  > {
  id: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function MenuItemCheckbox({
  id,
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  children,
  className,
  ref,
  onClick,
  onFocus,
  onMouseDown,
  ...rootProps
}: MenuItemCheckboxProps) {
  const { highlighted, activate, highlight, idPrefix, registerActivator, unregisterActivator } =
    useMenuContext();

  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: controlledChecked,
    defaultValue: defaultChecked,
    onChange,
  });

  const isFocused = highlighted === id;
  const itemId = getEncodedListboxItemId(idPrefix, id);

  useEffect(() => {
    const toggle = () => {
      if (disabled) return;
      setIsChecked((prev) => !prev);
    };
    registerActivator(id, toggle);
    return () => unregisterActivator(id);
  }, [id, disabled, registerActivator, unregisterActivator, setIsChecked]);

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

  const state = getItemState({ disabled, isFocused, isSelected: false });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space toggle is handled centrally by the menu container via useNavigation, not per item.
    <div
      {...rootProps}
      ref={ref}
      id={itemId}
      role="menuitemcheckbox"
      tabIndex={-1}
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-active={(!disabled && isFocused) || undefined}
      data-focus={isFocused || undefined}
      aria-checked={isChecked}
      aria-disabled={disabled || undefined}
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
        className={menuItemIndicator({ idle: (!isFocused && !disabled) || undefined })}
      >
        {isChecked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED}
      </span>
      <span className={menuItemLabel({ idle: (!isFocused && !disabled) || undefined })}>
        {children}
      </span>
    </div>
  );
}
