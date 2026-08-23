"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { Kbd } from "../kbd/kbd";
import { useCommandPaletteContext } from "./command-palette-context";
import { CommandPaletteCount } from "./command-palette-count";
import { getCommandPaletteItemDomId } from "./use-command-palette-state";

const INPUT_NAVIGATION_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter"]);

export interface CommandPaletteInputProps {
  /** Search input placeholder. */
  placeholder?: string;
  /** Accessible label text. */
  label?: string;
  /**
   * Optional leading content. When omitted, a CSS-driven glyph from
   * --command-palette-prefix-content is rendered (default ">"; terminal frame swaps to "$").
   */
  prefix?: ReactNode;
  /** Optional trailing content. Defaults to the `[n/m]` count readout plus an Esc close button. */
  suffix?: ReactNode;
  /** Accessible name for the default Esc close control. */
  closeLabel?: string;
  /** Called before the built-in command-palette key handling; call event.preventDefault() to suppress it. */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLInputElement>;
}

/** Search input with prefix/suffix slots (Esc Kbd by default) */
export function CommandPaletteInput({
  placeholder = "Type a command…",
  label = "Command search",
  prefix,
  suffix,
  closeLabel = "Close",
  onKeyDown,
  className,
  ref,
}: CommandPaletteInputProps) {
  const { open, onOpenChange, search, onSearchChange, navKeyDown, highlighted, listId, inputRef } =
    useCommandPaletteContext();
  const composedRef = useComposedRefs(inputRef, ref);

  return (
    <div data-slot="command-palette-input" className={className}>
      {prefix !== undefined ? (
        <span data-slot="command-palette-input-prefix">{prefix}</span>
      ) : (
        <span data-slot="command-palette-input-prefix" data-default aria-hidden="true" />
      )}
      <input
        ref={composedRef}
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
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
      />
      {suffix !== undefined ? (
        <span data-slot="command-palette-input-suffix">{suffix}</span>
      ) : (
        <span data-slot="command-palette-input-suffix">
          <CommandPaletteCount />
          {/* A real close control, not a hint: touch has no Esc key, and the
              ::before hit-area expansion in command-palette.css gives it a 44x44
              target without moving a single desktop pixel. */}
          <button
            type="button"
            data-slot="command-palette-close"
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <Kbd size="sm">Esc</Kbd>
          </button>
        </span>
      )}
    </div>
  );
}
