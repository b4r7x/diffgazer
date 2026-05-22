"use client";

import type { ComponentPropsWithRef, FocusEvent, MouseEvent, ReactNode, Ref } from "react";
import { cva } from "class-variance-authority";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";

const INDICATOR_ACTIVE = "\u258C";
const INDICATOR_IDLE = ">";

function MenuItemIndicator({ isFocused, isSelected, className }: { isFocused: boolean; isSelected: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]",
        className,
      )}
    >
      {isFocused || isSelected ? INDICATOR_ACTIVE : INDICATOR_IDLE}
    </span>
  );
}

function MenuItemIconSlot({
  icon,
  isFocused,
  isSelected,
  iconIdleClassName,
  indicatorIdleClassName,
}: {
  icon?: ReactNode;
  isFocused: boolean;
  isSelected: boolean;
  iconIdleClassName?: string;
  indicatorIdleClassName?: string;
}) {
  if (icon !== undefined) {
    const isEmphasized = isFocused || isSelected;
    return (
      <span
        aria-hidden="true"
        className={cn(
          "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]",
          !isEmphasized && iconIdleClassName,
        )}
      >
        {icon}
      </span>
    );
  }
  return (
    <MenuItemIndicator
      isFocused={isFocused}
      isSelected={isSelected}
      className={indicatorIdleClassName}
    />
  );
}

interface DefaultItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  isDanger: boolean;
  hotkey?: number | string;
  icon?: ReactNode;
  children: ReactNode;
}

function DefaultItemLayout({ isFocused, isSelected, isDanger, hotkey, icon, children }: DefaultItemLayoutProps) {
  const idleColor = isDanger ? "text-destructive" : "text-foreground";
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <MenuItemIconSlot
        icon={icon}
        isFocused={isFocused}
        isSelected={isSelected}
        iconIdleClassName={isEmphasized ? undefined : idleColor}
        indicatorIdleClassName={isEmphasized ? undefined : cn("transition-opacity opacity-0 group-hover:opacity-100", idleColor)}
      />
      {hotkey !== undefined && (
        <span
          aria-hidden="true"
          className={isEmphasized ? "mr-4 shrink-0" : cn("mr-4 shrink-0 group-hover:text-foreground", idleColor)}
        >
          [{hotkey}]
        </span>
      )}
      <span className={cn("tracking-wide", !isEmphasized && !isDanger && "group-hover:text-foreground")}>
        {children}
      </span>
    </>
  );
}

interface HubItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  value?: ReactNode;
  valueClassName: string;
  icon?: ReactNode;
  children: ReactNode;
}

function HubItemLayout({
  isFocused,
  isSelected,
  value,
  valueClassName,
  icon,
  children,
}: HubItemLayoutProps) {
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <div className="flex items-center">
        <MenuItemIconSlot
          icon={icon}
          isFocused={isFocused}
          isSelected={isSelected}
          indicatorIdleClassName={
            !isEmphasized ? "text-foreground opacity-0 group-hover:opacity-100 transition-opacity" : undefined
          }
        />
        <span className={isEmphasized ? undefined : "font-medium group-hover:text-foreground"}>
          {children}
        </span>
      </div>
      {value !== undefined && value !== null && <div className={valueClassName}>{value}</div>}
    </>
  );
}

type ItemState = "normal" | "focused" | "selected" | "disabled" | "disabledFocused";

function getItemState(disabled: boolean, isFocused: boolean, isSelected: boolean): ItemState {
  if (disabled && isFocused) return "disabledFocused";
  if (disabled) return "disabled";
  if (isFocused) return "focused";
  if (isSelected) return "selected";
  return "normal";
}

const menuItemBase = cva("cursor-pointer w-full transition-colors", {
  variants: {
    menuVariant: {
      default: "px-4 py-3 flex items-center font-mono duration-75",
      hub: "px-4 py-4 flex justify-between items-center text-sm border-b border-border last:border-b-0",
    },
      state: {
        normal: "hover:bg-secondary group",
        focused: "font-bold",
        selected: "font-bold group",
        disabled: "opacity-50 cursor-not-allowed",
        disabledFocused: "opacity-60 cursor-not-allowed bg-secondary text-foreground",
      },
    colorVariant: {
      default: "",
      danger: "",
    },
  },
  compoundVariants: [
    { state: "focused", menuVariant: "hub", class: "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" },
    { state: "disabled", menuVariant: "default", class: "hover:bg-transparent" },
    { state: "disabledFocused", menuVariant: "hub", class: "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" },
    { colorVariant: "danger", state: "focused", class: "bg-destructive text-destructive-foreground" },
    { colorVariant: "default", state: "focused", class: "bg-primary text-primary-foreground" },
    { colorVariant: "danger", state: "selected", class: "bg-destructive text-destructive-foreground" },
    { colorVariant: "default", state: "selected", class: "bg-primary text-primary-foreground" },
    { colorVariant: "danger", state: "normal", menuVariant: "default", class: "text-destructive" },
  ],
  defaultVariants: { menuVariant: "default", state: "normal", colorVariant: "default" },
});

const menuItemValue = cva("font-mono text-xs", {
  variants: {
    valueVariant: {
      default: "",
      success: "",
      "success-badge": "border px-2 py-0.5 rounded",
      muted: "",
    },
    focused: {
      true: "uppercase tracking-wide",
      false: "",
    },
    active: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      valueVariant: "default",
      active: false,
      class: "text-muted-foreground",
    },
    {
      valueVariant: "success",
      active: false,
      class: "text-success",
    },
    {
      valueVariant: "success-badge",
      active: false,
      class: "text-success border-success/30 bg-success/10",
    },
    {
      valueVariant: "muted",
      active: false,
      class: "text-muted-foreground/60",
    },
    {
      valueVariant: "default",
      active: true,
      class: "text-current",
    },
    {
      valueVariant: "success",
      active: true,
      class: "text-current",
    },
    {
      valueVariant: "muted",
      active: true,
      class: "text-current",
    },
    {
      valueVariant: "success-badge",
      active: true,
      class: "border-success bg-success text-success-foreground",
    },
  ],
  defaultVariants: { valueVariant: "default", focused: false, active: false },
});

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
  const { selectedId, highlighted, activate, highlight, variant: menuVariant, idPrefix, itemRole } =
    useMenuContext();

  const isSelected = !disabled && selectedId === id;
  const isFocused = highlighted === id;
  const isActive = !disabled && (isFocused || isSelected);
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";
  const state = getItemState(disabled, isFocused, isSelected);
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
    <div
      {...rootProps}
      ref={ref}
      id={itemId}
      role={itemRole}
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
        <DefaultItemLayout isFocused={isFocused} isSelected={isSelected} isDanger={isDanger} hotkey={hotkey} icon={icon}>
          {children}
        </DefaultItemLayout>
      )}
    </div>
  );
}
