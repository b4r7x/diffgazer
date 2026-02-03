"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMenuContext } from "./menu-context";

export interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: number | string;
  value?: ReactNode;
  valueVariant?: "default" | "success" | "success-badge" | "muted";
  children: ReactNode;
  className?: string;
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
}: MenuItemProps): JSX.Element | null {
  const { selectedIndex, onSelect, onActivate, items, variant: menuVariant } = useMenuContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";

  const handleClick = () => {
    if (disabled) return;
    onSelect(itemData.index);
    onActivate?.(itemData);
  };

  const selectedBg = isDanger ? "bg-tui-red" : "bg-tui-blue";

  const baseClasses = isHub
    ? "px-4 py-4 flex justify-between items-center cursor-pointer text-sm w-full border-b border-tui-border last:border-b-0"
    : "px-4 py-3 flex items-center cursor-pointer font-mono w-full";

  let baseTextClass = "text-tui-fg";
  if (!isHub && isDanger) baseTextClass = "text-tui-red";

  const stateClasses = isSelected
    ? cn(selectedBg, "text-black font-bold", isHub && "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]")
    : cn(baseTextClass, "hover:bg-tui-selection group transition-colors", !isHub && "duration-75");

  const getValueClasses = () => {
    if (isSelected) return "font-mono text-xs uppercase tracking-wide";
    if (valueVariant === "success-badge") {
      return "text-tui-green font-mono text-xs border border-tui-green/30 bg-tui-green/10 px-2 py-0.5 rounded";
    }
    if (valueVariant === "success") return "text-tui-violet font-mono text-xs";
    return "text-gray-500 font-mono text-xs";
  };

  const indicatorColor = isDanger ? "text-tui-red" : "text-tui-blue";

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(baseClasses, stateClasses, disabled && "opacity-50 cursor-not-allowed", className)}
    >
      {isHub ? (
        <>
          <div className="flex items-center">
            <span
              className={cn(
                "w-6",
                isSelected
                  ? "text-black"
                  : "text-tui-blue opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              {isSelected ? "▌" : "❯"}
            </span>
            <span className={cn(isSelected ? "" : "font-medium group-hover:text-white")}>{children}</span>
          </div>
          {value && <div className={getValueClasses()}>{value}</div>}
        </>
      ) : (
        <>
          <span
            className={cn(
              "mr-3 shrink-0",
              !isSelected && cn("opacity-0 group-hover:opacity-100", indicatorColor)
            )}
          >
            ▌
          </span>
          {hotkey !== undefined && (
            <span
              className={cn(
                "mr-4 shrink-0",
                !isSelected && cn("group-hover:text-tui-fg", indicatorColor)
              )}
            >
              [{hotkey}]
            </span>
          )}
          <span className={cn(!isHub && "tracking-wide", !isSelected && !isDanger && "group-hover:text-white")}>
            {children}
          </span>
        </>
      )}
    </div>
  );
}
