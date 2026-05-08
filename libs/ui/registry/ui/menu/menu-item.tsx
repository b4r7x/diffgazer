"use client";

import type { ReactNode, Ref } from "react";
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

interface DefaultItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  isDanger: boolean;
  hotkey?: number | string;
  children: ReactNode;
}

function DefaultItemLayout({ isFocused, isSelected, isDanger, hotkey, children }: DefaultItemLayoutProps) {
  const idleColor = isDanger ? "text-destructive" : "text-foreground";
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <MenuItemIndicator
        isFocused={isFocused}
        isSelected={isSelected}
        className={isEmphasized ? undefined : cn("transition-opacity opacity-0 group-hover:opacity-100", idleColor)}
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
  children: ReactNode;
}

function HubItemLayout({
  isFocused,
  isSelected,
  value,
  valueClassName,
  children,
}: HubItemLayoutProps) {
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <div className="flex items-center">
        <MenuItemIndicator
          isFocused={isFocused}
          isSelected={isSelected}
          className={
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

type ItemState = "normal" | "focused" | "selected" | "disabled";

function getItemState(disabled: boolean, isFocused: boolean, isSelected: boolean): ItemState {
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
    },
    colorVariant: {
      default: "",
      danger: "",
    },
  },
  compoundVariants: [
    { state: "focused", menuVariant: "hub", class: "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" },
    { state: "disabled", menuVariant: "default", class: "hover:bg-transparent" },
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
      true: "text-current",
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
      valueVariant: "success-badge",
      active: true,
      class: "border-current/30 bg-current/10",
    },
  ],
  defaultVariants: { valueVariant: "default", focused: false, active: false },
});

export interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: number | string;
  value?: ReactNode;
  valueVariant?: "default" | "success" | "success-badge" | "muted";
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function MenuItem({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  value,
  valueVariant = "default",
  children,
  className,
  ref,
}: MenuItemProps) {
  const { selectedId, highlightedId, activate, highlight, variant: menuVariant, idPrefix, itemRole } =
    useMenuContext();

  const isSelected = selectedId === id;
  const isFocused = highlightedId === id;
  const isActive = isFocused || isSelected;
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";
  const state = getItemState(disabled, isFocused, isSelected);
  const itemId = getEncodedListboxItemId(idPrefix, id);

  const handleClick = () => {
    if (!disabled) activate(id);
  };

  return (
    <div
      ref={ref}
      id={itemId}
      role={itemRole}
      data-value={id}
      data-active={isActive || undefined}
      aria-checked={itemRole === "menuitemradio" ? isSelected : undefined}
      aria-disabled={disabled || undefined}
      data-state={isSelected ? "selected" : "unselected"}
      onClick={handleClick}
      onFocus={() => {
        if (!disabled) highlight(id);
      }}
      className={cn(menuItemBase({ menuVariant, state, colorVariant: variant }), className)}
    >
      {isHub ? (
        <HubItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          value={value}
          valueClassName={menuItemValue({ valueVariant, focused: isActive, active: isActive })}
        >
          {children}
        </HubItemLayout>
      ) : (
        <DefaultItemLayout isFocused={isFocused} isSelected={isSelected} isDanger={isDanger} hotkey={hotkey}>
          {children}
        </DefaultItemLayout>
      )}
    </div>
  );
}
