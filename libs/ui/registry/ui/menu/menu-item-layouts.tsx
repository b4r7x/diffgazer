import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const INDICATOR_ACTIVE = "▌";
const INDICATOR_IDLE = ">";

const iconSlotBase =
  "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]";

function MenuItemIndicator({
  isFocused,
  isSelected,
  className,
}: {
  isFocused: boolean;
  isSelected: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn(iconSlotBase, className)}>
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
      <span aria-hidden="true" className={cn(iconSlotBase, !isEmphasized && iconIdleClassName)}>
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

/** Props for default item layout. */
interface DefaultItemLayoutProps {
  /** Whether default item layout is focused. */
  isFocused: boolean;
  /** Whether default item layout is selected. */
  isSelected: boolean;
  /** Whether default item layout is danger. */
  isDanger: boolean;
  /** Keyboard shortcut that focuses the region. */
  hotkey?: number | string;
  /** Icon content rendered by the component. */
  icon?: ReactNode;
  /** MenuItem and MenuDivider children. */
  children: ReactNode;
}

/**
 * Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey
 * indicators.
 */
export function DefaultItemLayout({
  isFocused,
  isSelected,
  isDanger,
  hotkey,
  icon,
  children,
}: DefaultItemLayoutProps) {
  const idleColor = isDanger ? "text-error" : "text-foreground";
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <MenuItemIconSlot
        icon={icon}
        isFocused={isFocused}
        isSelected={isSelected}
        iconIdleClassName={isEmphasized ? undefined : idleColor}
        indicatorIdleClassName={
          isEmphasized
            ? undefined
            : cn("transition-opacity opacity-0 group-hover:opacity-100", idleColor)
        }
      />
      {hotkey !== undefined && (
        // The bracketed glyphs stay aria-hidden so they do not pollute the item's
        // name or typeahead; MenuItem exposes the shortcut to AT via
        // aria-keyshortcuts instead.
        <span
          aria-hidden="true"
          className={
            isEmphasized
              ? "mr-4 shrink-0"
              : cn("mr-4 shrink-0 group-hover:text-foreground", idleColor)
          }
        >
          [{hotkey}]
        </span>
      )}
      <span
        className={cn("tracking-wide", !isEmphasized && !isDanger && "group-hover:text-foreground")}
      >
        {children}
      </span>
    </>
  );
}

/** Props for detail item layout. */
interface DetailItemLayoutProps {
  /** Whether detail item layout is focused. */
  isFocused: boolean;
  /** Whether detail item layout is selected. */
  isSelected: boolean;
  /** Controlled value. */
  value?: ReactNode;
  valueClassName: string;
  /** Icon content rendered by the component. */
  icon?: ReactNode;
  /** MenuItem and MenuDivider children. */
  children: ReactNode;
}

/**
 * Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey
 * indicators.
 */
export function DetailItemLayout({
  isFocused,
  isSelected,
  value,
  valueClassName,
  icon,
  children,
}: DetailItemLayoutProps) {
  const isEmphasized = isFocused || isSelected;

  return (
    <>
      <div className="flex items-center">
        <MenuItemIconSlot
          icon={icon}
          isFocused={isFocused}
          isSelected={isSelected}
          indicatorIdleClassName={
            !isEmphasized
              ? "text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              : undefined
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
