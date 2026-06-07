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

interface DefaultItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  isDanger: boolean;
  hotkey?: number | string;
  icon?: ReactNode;
  children: ReactNode;
}

export function DefaultItemLayout({
  isFocused,
  isSelected,
  isDanger,
  hotkey,
  icon,
  children,
}: DefaultItemLayoutProps) {
  const idleColor = isDanger ? "text-destructive" : "text-foreground";
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

interface HubItemLayoutProps {
  isFocused: boolean;
  isSelected: boolean;
  value?: ReactNode;
  valueClassName: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function HubItemLayout({
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
