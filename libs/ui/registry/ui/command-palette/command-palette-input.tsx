"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from "react";
import { Kbd } from "@/components/ui/kbd";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";
import { getCommandPaletteItemDomId } from "./use-state";

const INPUT_NAVIGATION_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter"]);

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
  placeholder = "Type a command…",
  label = "Command search",
  prefix,
  suffix,
  onKeyDown,
  className,
  ref,
}: CommandPaletteInputProps) {
  const { open, search, onSearchChange, navKeyDown, highlighted, listId, inputRef } =
    useCommandPaletteContext();

  return (
    <div data-slot="command-palette-input" className={cn(className)}>
      {prefix !== undefined ? (
        <span data-slot="command-palette-input-prefix">{prefix}</span>
      ) : (
        <span data-slot="command-palette-input-prefix" data-default aria-hidden="true" />
      )}
      <input
        ref={ref ? composeRefs(inputRef, ref) : inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          highlighted !== null ? getCommandPaletteItemDomId(listId, highlighted) : undefined
        }
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
          if (INPUT_NAVIGATION_KEYS.has(e.key)) navKeyDown(e);
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none p-0 text-foreground placeholder-muted-foreground/70 font-mono caret-foreground"
        style={{ fontSize: "var(--cp-text-size)" }}
      />
      {suffix !== undefined ? (
        <span data-slot="command-palette-input-suffix">{suffix}</span>
      ) : (
        <span data-slot="command-palette-input-suffix">
          <Kbd size="sm">Esc</Kbd>
        </span>
      )}
    </div>
  );
}
