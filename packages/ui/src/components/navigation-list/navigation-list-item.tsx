import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useNavigationListContext } from "./navigation-list-context";

const navigationListItemVariants = cva("flex cursor-pointer group", {
  variants: {
    density: {
      compact: "",
      default: "",
      comfortable: "",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

const contentPaddingMap: Record<string, string> = {
  compact: "p-2",
  default: "p-3",
  comfortable: "p-4",
};

export interface NavigationListItemProps extends VariantProps<typeof navigationListItemVariants> {
  id: string;
  disabled?: boolean;
  badge?: ReactNode;
  statusIndicator?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function NavigationListItem({
  id,
  disabled = false,
  badge,
  statusIndicator,
  subtitle,
  density = "default",
  children,
  className,
}: NavigationListItemProps) {
  const { selectedId, focusedValue, onSelect, onActivate, isFocused } = useNavigationListContext();
  const isSelected = selectedId === id;
  const isFocusedItem = focusedValue === id;
  const showSelection = (isSelected || isFocusedItem) && isFocused;

  const handleClick = () => {
    if (!disabled) {
      onSelect(id);
      onActivate?.(id);
    }
  };

  return (
    <div
      id={`navlist-${id}`}
      role="option"
      data-value={id}
      data-state={isSelected ? "selected" : "unselected"}
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        navigationListItemVariants({ density }),
        showSelection && "bg-tui-blue text-black",
        !showSelection && "hover:bg-tui-selection border-b border-tui-border/50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div
        className={cn(
          "w-1 shrink-0",
          showSelection ? "bg-black/40" : "bg-transparent group-hover:bg-tui-muted"
        )}
      />
      <div className={cn("flex-1", contentPaddingMap[density ?? "default"])}>
        <div className="flex justify-between items-start mb-1">
          <span className={cn("font-bold flex items-center", showSelection && "text-black")}>
            <span className={cn("mr-2", !showSelection && "opacity-0")}>{"\u258C"}</span>
            {children}
          </span>
          {statusIndicator && (
            <span className={cn("text-[10px] font-bold", showSelection ? "text-black" : "text-tui-yellow")}>
              {statusIndicator}
            </span>
          )}
        </div>
        {(badge || subtitle) && (
          <div className="flex gap-2 items-center">
            {badge && (
              <span className={cn(
                "inline-flex items-center leading-none",
                showSelection && "[&>*]:!bg-tui-bg [&>*]:!text-tui-blue [&>*]:!border-tui-blue [&_*]:!text-tui-blue"
              )}>
                {badge}
              </span>
            )}
            {subtitle && (
              <span className={cn(
                "text-[9px] inline-flex items-center leading-none",
                showSelection ? "text-black/70" : "text-tui-muted"
              )}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
