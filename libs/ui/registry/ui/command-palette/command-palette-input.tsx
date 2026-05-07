"use client";

import { cn } from "@/lib/utils";
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { useCommandPaletteContext } from "./command-palette-context";
import { getCommandPaletteItemDomId } from "./use-command-palette-state";

export interface CommandPaletteInputProps {
  placeholder?: string;
  label?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export function CommandPaletteInput({
  placeholder = "Type a command...",
  label = "Command search",
  prefix,
  suffix,
  onKeyDown,
  className,
  ref,
}: CommandPaletteInputProps) {
  const { open, search, onSearchChange, navKeyDown, selectedId, listId } = useCommandPaletteContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex items-center p-4 border-b border-border/60", className)}>
      {prefix ?? <span className="text-foreground text-[20px] mr-3 font-bold select-none">&gt;</span>}
      <input
        ref={ref ? composeRefs(inputRef, ref) : inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={selectedId !== null ? getCommandPaletteItemDomId(listId, selectedId) : undefined}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "Escape") {
            if (search) {
              e.preventDefault();
              onSearchChange("");
            }
            return;
          }
          if (e.key === " ") return;
          navKeyDown(e);
        }}
        placeholder={placeholder}
        className="w-full bg-transparent border-none p-0 text-foreground placeholder-muted-foreground/70 font-mono text-sm caret-foreground h-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      {suffix ?? (
        <div className="text-[10px] font-bold text-muted-foreground border border-border px-1.5 py-0.5 rounded ml-2 select-none">
          ESC
        </div>
      )}
    </div>
  );
}
