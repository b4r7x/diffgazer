"use client";

import { useCallback, useLayoutEffect, useId, useMemo, useRef } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { matchesSearch } from "@/lib/search";
import { useItemRegistry } from "./use-item-registry";
import type { CommandPaletteContextValue } from "./command-palette-context";

const defaultFilter = matchesSearch;

export interface UseCommandPaletteStateOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  onActivate?: (id: string) => void;
  shouldFilter?: boolean;
  filter?: (value: string, search: string) => boolean;
}

export function useCommandPaletteState({
  open: controlledOpen,
  onOpenChange,
  search: controlledSearch,
  onSearchChange: controlledOnSearchChange,
  selectedId: controlledSelectedId,
  onSelectedIdChange,
  onActivate,
  shouldFilter = true,
  filter: filterProp,
}: UseCommandPaletteStateOptions): CommandPaletteContextValue {
  const filter = filterProp ?? defaultFilter;
  const [isOpen, setIsOpen] = useControllableState({ value: controlledOpen, defaultValue: false, onChange: onOpenChange });
  const [search, setSearch] = useControllableState({ value: controlledSearch, defaultValue: "", onChange: controlledOnSearchChange });
  const [selectedId, setSelectedId, isSelectedControlled] = useControllableState<string | null>({ value: controlledSelectedId, defaultValue: null, onChange: onSelectedIdChange });
  const { items, itemCount, registerItem, unregisterItem, setItemCallback, getItemCallback } = useItemRegistry();
  const listRef = useRef<HTMLDivElement>(null);
  const paletteId = useId();

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setSearch("");
    setIsOpen(next);
  }, [setIsOpen, setSearch]);

  const handleActivate = useCallback((id: string) => {
    getItemCallback(id)?.();
    onActivate?.(id);
    handleOpenChange(false);
  }, [getItemCallback, handleOpenChange, onActivate]);

  const { onKeyDown: rawNavKeyDown } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    value: selectedId,
    onValueChange: setSelectedId,
    onEnter: handleActivate,
    enabled: isOpen,
  });
  const navKeyDown = rawNavKeyDown;

  const autoSelectFirst = useCallback(() => {
    if (isSelectedControlled) return;
    setSelectedId((currentId) => {
      if (currentId && items.includes(currentId)) return currentId;
      return items[0] ?? null;
    });
  }, [isSelectedControlled, items, setSelectedId]);

  useLayoutEffect(() => {
    autoSelectFirst();
  }, [autoSelectFirst]);

  return useMemo(() => ({
    open: isOpen, onOpenChange: handleOpenChange, selectedId,
    onActivate: handleActivate, search, onSearchChange: setSearch,
    shouldFilter, filter, itemCount,
    registerItem, unregisterItem, setItemCallback, getItemCallback,
    listId: `${paletteId}-list`, listRef, navKeyDown,
  }), [isOpen, handleOpenChange, handleActivate, selectedId, search, setSearch, shouldFilter, filter, itemCount, registerItem, unregisterItem, setItemCallback, getItemCallback, paletteId, navKeyDown]);
}
