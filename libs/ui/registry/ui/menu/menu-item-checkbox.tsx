"use client";

import {
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";
import { getItemState, menuItemBase, menuItemIndicator, menuItemLabel } from "./menu-item-variants";
import { useMenuItemInteractions } from "./use-menu-item-interactions";

const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";

/** Props for menu item checkbox. */
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
  /** Stable identifier for the checkbox item. */
  id: string;
  /** Controlled checked state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled mode. */
  defaultChecked?: boolean;
  /** Fired when the checked state toggles. */
  onChange?: (checked: boolean) => void;
  /** Disables the checkbox item. */
  disabled?: boolean;
  /** Checkbox item label. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Toggleable checkbox item. */
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
  const {
    highlighted,
    activate,
    highlight,
    idPrefix,
    registerItem,
    unregisterItem,
    registerActivator,
    unregisterActivator,
  } = useMenuContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);

  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: controlledChecked,
    defaultValue: defaultChecked,
    onChange,
  });

  const isFocused = highlighted === id;
  const itemId = getEncodedListboxItemId(idPrefix, id);

  useLayoutEffect(() => {
    registerItem(registrationId, id, disabled, rootRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, id, disabled]);

  useEffect(() => {
    const toggle = () => {
      if (disabled) return;
      setIsChecked((prev) => !prev);
    };
    registerActivator(id, toggle);
    return () => unregisterActivator(id);
  }, [id, disabled, registerActivator, unregisterActivator, setIsChecked]);

  const { handleClick, handleFocus, handleMouseDown } = useMenuItemInteractions({
    id,
    disabled,
    activate,
    highlight,
    onClick,
    onFocus,
    onMouseDown,
  });

  const state = getItemState({ disabled, isFocused, isSelected: false });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space toggle is handled centrally by the menu container via useNavigation, not per item.
    <div
      {...rootProps}
      ref={composedRef}
      id={itemId}
      role="menuitemcheckbox"
      tabIndex={-1}
      data-slot="menu-item-checkbox"
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-highlighted={isFocused ? "" : undefined}
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
