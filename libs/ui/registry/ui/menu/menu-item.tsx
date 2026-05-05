"use client";

import type { ReactNode, Ref } from "react";
import { cva } from "class-variance-authority";
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

function HubItemLayout({ isFocused, isSelected, value, valueClassName, children }: HubItemLayoutProps) {
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <div className="flex items-center">
        <MenuItemIndicator
          isFocused={isFocused}
          isSelected={isSelected}
          className={isFocused
            ? "text-background"
            : isEmphasized
              ? undefined
              : "text-foreground opacity-0 group-hover:opacity-100 transition-opacity"}
        />
        <span className={isEmphasized ? undefined : "font-medium group-hover:text-foreground"}>
          {children}
        </span>
      </div>
      {value && <div className={valueClassName}>{value}</div>}
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
      focused: "text-background font-bold",
      selected: "bg-secondary font-bold group",
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
    { colorVariant: "danger", state: "focused", class: "bg-destructive" },
    { colorVariant: "default", state: "focused", class: "bg-foreground" },
    { colorVariant: "danger", state: "normal", menuVariant: "default", class: "text-destructive" },
    { colorVariant: "danger", state: "selected", menuVariant: "default", class: "text-destructive" },
  ],
  defaultVariants: { menuVariant: "default", state: "normal", colorVariant: "default" },
});

const menuItemValue = cva("font-mono text-xs", {
  variants: {
    valueVariant: {
      default: "text-muted-foreground",
      success: "text-success",
      "success-badge": "text-success border border-success/30 bg-success/10 px-2 py-0.5 rounded",
      muted: "text-muted-foreground/60",
    },
    focused: {
      true: "uppercase tracking-wide text-background/80",
      false: "",
    },
  },
  defaultVariants: { valueVariant: "default", focused: false },
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
  const { selectedId, highlightedId, activate, highlight, variant: menuVariant, idPrefix } =
    useMenuContext();

  const isSelected = selectedId === id;
  const isFocused = highlightedId === id;
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";
  const state = getItemState(disabled, isFocused, isSelected);

  const handleClick = () => {
    if (!disabled) activate(id);
  };

  const handleHighlight = () => {
    if (!disabled) highlight(id);
  };

  return (
    <div
      ref={ref}
      id={`${idPrefix}-${id}`}
      role="menuitem"
      data-value={id}
      aria-current={isSelected || undefined}
      aria-disabled={disabled || undefined}
      data-state={isSelected ? "selected" : "unselected"}
      onClick={handleClick}
      onMouseEnter={handleHighlight}
      onFocus={handleHighlight}
      className={cn(menuItemBase({ menuVariant, state, colorVariant: variant }), className)}
    >
      {isHub ? (
        <HubItemLayout
          isFocused={isFocused}
          isSelected={isSelected}
          value={value}
          valueClassName={menuItemValue({ valueVariant, focused: isFocused })}
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
