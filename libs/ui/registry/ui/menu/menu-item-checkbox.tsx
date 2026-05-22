"use client";

import {
  useEffect,
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { MENU_ITEM_BASE_CLASS, useMenuContext } from "./menu-context";

const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";

export interface MenuItemCheckboxProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-checked" | "aria-disabled" | "data-value" | "ref"
  > {
  id: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function MenuItemCheckbox({
  id,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
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
    onChange: onCheckedChange,
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

  const stateClass = disabled
    ? isFocused
      ? "opacity-60 cursor-not-allowed bg-secondary text-foreground"
      : "opacity-50 cursor-not-allowed hover:bg-transparent"
    : isFocused
      ? "bg-primary text-primary-foreground font-bold"
      : "hover:bg-secondary group";

  return (
    <div
      {...rootProps}
      ref={ref}
      id={itemId}
      role="menuitemcheckbox"
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-active={(!disabled && isFocused) || undefined}
      data-focus={isFocused || undefined}
      aria-checked={isChecked}
      aria-disabled={disabled || undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(MENU_ITEM_BASE_CLASS, stateClass, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pr-4 shrink-0 inline-flex items-center justify-center self-center leading-none font-mono text-xs",
          !isFocused && !disabled && "transition-opacity opacity-60 group-hover:opacity-100",
        )}
      >
        {isChecked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED}
      </span>
      <span className={cn("tracking-wide", !isFocused && !disabled && "group-hover:text-foreground")}>
        {children}
      </span>
    </div>
  );
}
