"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { sortSelectableCollectionItems } from "@/lib/selectable-collection";
import { matchesSearch } from "@/lib/search";
import type { CommandPaletteContextValue } from "./command-palette-context";

const defaultFilter = matchesSearch;

export function getCommandPaletteItemDomId(listId: string, id: string): string {
  const encoded = Array.from(id, (char) => char.codePointAt(0)?.toString(36) ?? "0").join("-");
  return `${listId}-item-${encoded || "empty"}`;
}

export interface UseCommandPaletteStateOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
  onActivate?: (id: string) => void;
  shouldFilter?: boolean;
  filter?: (value: string, search: string) => boolean;
}

export function useCommandPaletteState({
  open: controlledOpen,
  onOpenChange,
  search: controlledSearch,
  onSearchChange: controlledOnSearchChange,
  highlighted: controlledHighlighted,
  onHighlightChange,
  onActivate,
  shouldFilter = true,
  filter: filterProp,
}: UseCommandPaletteStateOptions): CommandPaletteContextValue {
  const [registeredItems, setRegisteredItems] = useState<CommandPaletteItemRegistration[]>([]);
  const filter = filterProp ?? defaultFilter;
  const [isOpen, setIsOpen] = useControllableState({ value: controlledOpen, defaultValue: false, onChange: onOpenChange });
  const [search, setSearch] = useControllableState({ value: controlledSearch, defaultValue: "", onChange: controlledOnSearchChange });
  const [highlighted, setHighlighted, isHighlightedControlled] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: controlledHighlighted !== undefined,
    defaultValue: null,
    onChange: onHighlightChange,
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteId = useId();
  const activeItems = useMemo(
    () => sortSelectableCollectionItems(registeredItems)
      .filter((item) => !item.disabled && item.element !== null),
    [registeredItems],
  );
  const itemCallbacks = useMemo(
    () => new Map(activeItems.map((item) => [item.id, item.onSelect])),
    [activeItems],
  );
  const itemIds = useMemo(() => activeItems.map((item) => item.id), [activeItems]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setSearch("");
    setIsOpen(next);
  }, [setIsOpen, setSearch]);

  const handleActivate = useCallback((id: string) => {
    itemCallbacks.get(id)?.();
    onActivate?.(id);
    handleOpenChange(false);
  }, [handleOpenChange, itemCallbacks, onActivate]);

  const registerItem = useCallback((item: CommandPaletteItemRegistration) => {
    setRegisteredItems((current) => {
      const existingIndex = current.findIndex((candidate) => candidate.registrationId === item.registrationId);
      const next = existingIndex === -1 ? [...current, item] : [...current];
      if (existingIndex !== -1) next[existingIndex] = item;
      return next;
    });
  }, []);

  const unregisterItem = useCallback((registrationId: string) => {
    setRegisteredItems((current) => current.filter((item) => item.registrationId !== registrationId));
  }, []);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    highlighted: getEffectiveHighlighted(highlighted, itemIds, isHighlightedControlled),
    onHighlightChange: setHighlighted,
    onEnter: handleActivate,
    enabled: isOpen,
    scopeToContainer: true,
  });

  return useMemo(() => ({
    open: isOpen, onOpenChange: handleOpenChange, highlighted: getEffectiveHighlighted(highlighted, itemIds, isHighlightedControlled),
    onHighlightChange: setHighlighted,
    onActivate: handleActivate, search, onSearchChange: setSearch,
    shouldFilter, filter, itemCount: itemIds.length,
    listId: `${paletteId}-list`, listRef, inputRef, navKeyDown, registerItem, unregisterItem,
  }), [isOpen, handleOpenChange, handleActivate, highlighted, itemIds, isHighlightedControlled, setHighlighted, search, setSearch, shouldFilter, filter, paletteId, navKeyDown, registerItem, unregisterItem]);
}

export interface CommandPaletteItemMetadata {
  id: string;
  value: string;
  disabled: boolean;
  onSelect?: () => void;
}

export interface CommandPaletteItemRegistration extends CommandPaletteItemMetadata {
  registrationId: string;
  element: HTMLElement | null;
}

function getEffectiveHighlighted(
  highlighted: string | null,
  items: readonly string[],
  isControlled: boolean,
): string | null {
  if (highlighted !== null && items.includes(highlighted)) return highlighted;
  if (isControlled) return null;
  return items[0] ?? null;
}
