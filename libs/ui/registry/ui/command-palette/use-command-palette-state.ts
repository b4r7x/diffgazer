"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { matchesSearch } from "@/lib/search";
import type { CommandPaletteContextValue } from "./command-palette-context";

const defaultFilter = matchesSearch;

export function getCommandPaletteItemDomId(listId: string, id: string): string {
  const encoded = Array.from(id, (char) => char.codePointAt(0)?.toString(36) ?? "0").join("-");
  return `${listId}-item-${encoded || "empty"}`;
}

export interface UseCommandPaletteStateOptions {
  items: readonly CommandPaletteItemMetadata[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  highlightedId?: string | null;
  onHighlightChange?: (id: string | null) => void;
  /** @deprecated Use `highlightedId` for controlled highlight state. */
  selectedId?: string | null;
  /** @deprecated Use `onHighlightChange` for controlled highlight updates. */
  onSelectedIdChange?: (id: string | null) => void;
  onActivate?: (id: string) => void;
  shouldFilter?: boolean;
  filter?: (value: string, search: string) => boolean;
}

export function useCommandPaletteState({
  items: allItems,
  open: controlledOpen,
  onOpenChange,
  search: controlledSearch,
  onSearchChange: controlledOnSearchChange,
  highlightedId: controlledHighlightedId,
  onHighlightChange,
  selectedId: controlledSelectedId,
  onSelectedIdChange,
  onActivate,
  shouldFilter = true,
  filter: filterProp,
}: UseCommandPaletteStateOptions): CommandPaletteContextValue {
  const filter = filterProp ?? defaultFilter;
  const [isOpen, setIsOpen] = useControllableState({ value: controlledOpen, defaultValue: false, onChange: onOpenChange });
  const [search, setSearch] = useControllableState({ value: controlledSearch, defaultValue: "", onChange: controlledOnSearchChange });
  const [selectedId, setSelectedId, isSelectedControlled] = useControllableState<string | null>({
    value: controlledHighlightedId !== undefined ? controlledHighlightedId : controlledSelectedId,
    controlled: controlledHighlightedId !== undefined || controlledSelectedId !== undefined,
    defaultValue: null,
    onChange: onHighlightChange ?? onSelectedIdChange,
  });
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const paletteId = useId();
  const items = useMemo(
    () => allItems
      .filter((item) => !item.disabled && (!shouldFilter || !search || filter(item.value, search)))
      .map((item) => item.id),
    [allItems, filter, search, shouldFilter],
  );
  const itemCallbacks = useMemo(
    () => new Map(allItems.map((item) => [item.id, item.onSelect])),
    [allItems],
  );

  const handleOpenChange = useCallback((next: boolean) => {
    if (next && !previousFocusRef.current && typeof document !== "undefined") {
      previousFocusRef.current = document.activeElement;
    }
    if (!next) setSearch("");
    setIsOpen(next);
  }, [setIsOpen, setSearch]);

  const handleActivate = useCallback((id: string) => {
    itemCallbacks.get(id)?.();
    onActivate?.(id);
    handleOpenChange(false);
  }, [handleOpenChange, itemCallbacks, onActivate]);

  const { onKeyDown: rawNavKeyDown } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    value: getEffectiveSelectedId(selectedId, items, isSelectedControlled),
    onValueChange: setSelectedId,
    onEnter: handleActivate,
    enabled: isOpen,
  });
  const navKeyDown = rawNavKeyDown;

  return useMemo(() => ({
    open: isOpen, onOpenChange: handleOpenChange, previousFocusRef, selectedId: getEffectiveSelectedId(selectedId, items, isSelectedControlled),
    onActivate: handleActivate, search, onSearchChange: setSearch,
    shouldFilter, filter, itemCount: items.length,
    listId: `${paletteId}-list`, listRef, navKeyDown,
  }), [isOpen, handleOpenChange, handleActivate, selectedId, items, isSelectedControlled, search, setSearch, shouldFilter, filter, paletteId, navKeyDown]);
}

export interface CommandPaletteItemMetadata {
  id: string;
  value: string;
  disabled: boolean;
  onSelect?: () => void;
}

function getEffectiveSelectedId(
  selectedId: string | null,
  items: readonly string[],
  isControlled: boolean,
): string | null {
  if (selectedId !== null && items.includes(selectedId)) return selectedId;
  if (isControlled) return null;
  return items[0] ?? null;
}
