"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";

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

export interface CommandPaletteItemProps {
  id: string;
  value?: string;
  icon?: ReactNode;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function CommandPaletteItem({
  id, value, icon, shortcut, onSelect, disabled = false, children, className,
}: CommandPaletteItemProps) {
  const { selectedId, onActivate, registerItem, unregisterItem, setItemCallback, search, shouldFilter, filter } = useCommandPaletteContext();

  const searchValue = value ?? id;
  const isVisible = !shouldFilter || !search || filter(searchValue, search);

  useLayoutEffect(() => {
    if (disabled || !isVisible) return;
    registerItem(id);
    return () => unregisterItem(id);
  }, [id, disabled, isVisible]);

  useLayoutEffect(() => {
    setItemCallback(id, disabled ? undefined : onSelect);
    return () => setItemCallback(id, undefined);
  }, [id, onSelect, disabled]);

  if (!isVisible) return null;

  const isSelected = selectedId === id;

  return (
    <div
      id={id}
      role="option"
      data-value={id}
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      onClick={() => { if (disabled) return; onActivate(id); }}
      className={cn(itemVariants({ selected: isSelected, disabled }), className)}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className={cn("text-[18px]", !isSelected && "text-muted-foreground group-hover:text-foreground")}>
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
      {isSelected && (
        <span className="text-[10px] font-bold opacity-70">{"\u21B5"}</span>
      )}
      {!isSelected && shortcut && (
        <span className="text-[10px] text-muted-foreground/70 group-hover:text-muted-foreground font-mono">{shortcut}</span>
      )}
    </div>
  );
}
