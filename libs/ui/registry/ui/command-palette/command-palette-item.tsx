"use client";

import { useId, useLayoutEffect, useRef, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";
import { getCommandPaletteItemDomId } from "./use-command-palette-state";

const itemVariants = cva(
  "w-full text-left flex items-center justify-between px-3 py-2.5 text-sm group cursor-pointer select-none",
  {
    variants: {
      selected: {
        true: "bg-foreground text-background font-medium",
        false: "text-foreground hover:bg-secondary hover:text-foreground transition-colors",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
      },
    },
    defaultVariants: { selected: false },
  }
);

export interface CommandPaletteItemProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "id" | "onSelect"> {
  id: string;
  value?: string;
  icon?: ReactNode;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function CommandPaletteItem({
  id,
  value,
  icon,
  shortcut,
  onSelect,
  disabled = false,
  children,
  className,
  ref,
  onClick,
  ...props
}: CommandPaletteItemProps) {
  const {
    highlightedId,
    onActivate,
    search,
    shouldFilter,
    filter,
    listId,
    registerItem,
    unregisterItem,
  } = useCommandPaletteContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const searchValue = value ?? id;
  const isVisible = !shouldFilter || !search || filter(searchValue, search);

  useLayoutEffect(() => {
    registerItem({
      registrationId,
      id,
      value: searchValue,
      disabled: disabled || !isVisible,
      onSelect: disabled ? undefined : onSelect,
      element: isVisible ? rootRef.current : null,
    });
    return () => unregisterItem(registrationId);
  }, [disabled, id, isVisible, onSelect, registerItem, registrationId, searchValue, unregisterItem]);

  if (!isVisible) return null;

  const isHighlighted = highlightedId === id;
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) onActivate(id);
  };

  return (
    <div
      {...props}
      ref={composeRefs(rootRef, ref)}
      id={getCommandPaletteItemDomId(listId, id)}
      role="option"
      data-value={id}
      aria-selected={isHighlighted}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      className={cn(itemVariants({ selected: isHighlighted, disabled }), className)}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className={cn("text-[18px]", !isHighlighted && "text-muted-foreground group-hover:text-foreground")}>
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
      {isHighlighted && (
        <span className="text-[10px] font-bold opacity-70">{"\u21B5"}</span>
      )}
      {!isHighlighted && shortcut && (
        <span className="text-[10px] text-muted-foreground/70 group-hover:text-muted-foreground font-mono">{shortcut}</span>
      )}
    </div>
  );
}
