import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { useMenuContext } from "./menu-context";

const menuItemBase = cva("cursor-pointer w-full transition-colors", {
  variants: {
    menuVariant: {
      default: "px-4 py-3 flex items-center font-mono duration-75",
      hub: "px-4 py-4 flex justify-between items-center text-sm border-b border-tui-border last:border-b-0",
    },
  },
  defaultVariants: {
    menuVariant: "default",
  },
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
}: MenuItemProps) {
  const { selectedId, focusedValue, onSelect, onActivate, variant: menuVariant } = useMenuContext();

  const isSelected = selectedId === id;
  const isFocused = focusedValue === id;
  const isHighlighted = isSelected || isFocused;
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";

  const handleClick = () => {
    if (disabled) return;
    onSelect(id);
    onActivate?.(id);
  };

  const selectedBg = isDanger ? "bg-tui-red" : "bg-tui-blue";

  const baseTextClass = !isHub && isDanger ? "text-tui-red" : "text-tui-fg";

  let stateClasses = cn(baseTextClass, "hover:bg-tui-selection group", !isHub && "duration-75");
  if (disabled) {
    stateClasses = cn(baseTextClass, "opacity-50", !isHub && "hover:bg-transparent");
  } else if (isHighlighted) {
    stateClasses = cn(
      selectedBg,
      "text-primary-foreground font-bold",
      isHub && "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]"
    );
  }

  let valueClasses = "text-tui-muted font-mono text-xs";
  if (isHighlighted) {
    valueClasses = "font-mono text-xs uppercase tracking-wide";
  } else if (valueVariant === "success-badge") {
    valueClasses = "text-tui-green font-mono text-xs border border-tui-green/30 bg-tui-green/10 px-2 py-0.5 rounded";
  } else if (valueVariant === "success") {
    valueClasses = "text-tui-violet font-mono text-xs";
  }

  const indicatorColor = isDanger ? "text-tui-red" : "text-tui-blue";

  return (
    <div
      id={`menu-item-${id}`}
      role="option"
      data-value={id}
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-state={isSelected ? "selected" : "unselected"}
      onClick={handleClick}
      className={cn(menuItemBase({ menuVariant }), stateClasses, disabled && "cursor-not-allowed", className)}
    >
      {isHub ? (
        <>
          <div className="flex items-center">
            <span
              className={cn(
                "w-6",
                isHighlighted
                  ? "text-primary-foreground"
                  : "text-tui-blue opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              {isHighlighted ? "\u258C" : "\u276F"}
            </span>
            <span className={cn(isHighlighted ? "" : "font-medium group-hover:text-tui-fg")}>{children}</span>
          </div>
          {value && <div className={valueClasses}>{value}</div>}
        </>
      ) : (
        <>
          <span
            className={cn(
              "mr-3 shrink-0",
              !isHighlighted && cn("opacity-0 group-hover:opacity-100", indicatorColor)
            )}
          >
            {"\u258C"}
          </span>
          {hotkey !== undefined && (
            <span
              className={cn(
                "mr-4 shrink-0",
                !isHighlighted && cn("group-hover:text-tui-fg", indicatorColor)
              )}
            >
              [{hotkey}]
            </span>
          )}
          <span className={cn(!isHub && "tracking-wide", !isHighlighted && !isDanger && "group-hover:text-tui-fg")}>
            {children}
          </span>
        </>
      )}
    </div>
  );
}
