"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useRef,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useNavigation } from "@/hooks/use-navigation";
import { encodeDomIdSegment } from "@/lib/dom-id";
import { matchesSearch } from "@/lib/search";
import {
  type CommandPaletteItemRegistration,
  useCommandPaletteItemRegistry,
} from "./use-item-registry";

/** Context value shared by command palette. */
export interface CommandPaletteContextValue {
  /**
   * Controlled open state. Required to actually show the palette - wire a trigger button or
   * shortcut to setOpen(true).
   */
  open: boolean;
  /** Called whenever open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Controlled highlighted item id. */
  highlighted: string | null;
  /** Called when the highlighted item changes. */
  onHighlightChange: (id: string | null) => void;
  /** Called when an item is activated (Enter or click). Fires after the item's own onSelect. */
  onActivate: (id: string) => void;
  /** Controlled search query. */
  search: string;
  /** Called when the search query changes. */
  onSearchChange: (value: string) => void;
  /** Auto-filter items by search. Pass false to handle filtering yourself (e.g. server-side). */
  shouldFilter: boolean;
  /**
   * Custom filter function. Defaults to case-insensitive substring match on the item's value
   * (or id).
   */
  filter: (value: string, search: string) => boolean;
  /** Number of items currently rendered in the list (post-filter). */
  itemCount: number;
  /**
   * 1-based position of the highlighted item within the rendered list, or null
   * when nothing is highlighted. Derived during render from the same registry
   * `itemCount` reads, so the readout can never disagree with the list.
   */
  highlightedPosition: number | null;
  /** DOM id for list. */
  listId: string;
  /** Ref for the list element. */
  listRef: RefObject<HTMLDivElement | null>;
  /** Ref for the input element. */
  inputRef: RefObject<HTMLInputElement | null>;
  navKeyDown: (event: ReactKeyboardEvent) => void;
  /** Registers item with command palette. */
  registerItem: (item: CommandPaletteItemRegistration) => void;
  /** Unregisters item from command palette. */
  unregisterItem: (registrationId: string) => void;
}

export function getCommandPaletteItemDomId(listId: string, id: string): string {
  const encoded = encodeDomIdSegment(id);
  return `${listId}-item-${encoded || "empty"}`;
}

/** Options for use command palette state. */
export interface UseCommandPaletteStateOptions {
  /**
   * Controlled open state. Required to actually show the palette - wire a trigger button or
   * shortcut to setOpen(true).
   */
  open?: boolean;
  /** Called whenever open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Controlled search query. */
  search?: string;
  /** Called when the search query changes. */
  onSearchChange?: (value: string) => void;
  /** Controlled highlighted item id. */
  highlighted?: string | null;
  /** Called when the highlighted item changes. */
  onHighlightChange?: (id: string | null) => void;
  /** Called when an item is activated (Enter or click). Fires after the item's own onSelect. */
  onActivate?: (id: string) => void;
  /** Auto-filter items by search. Pass false to handle filtering yourself (e.g. server-side). */
  shouldFilter?: boolean;
  /**
   * Custom filter function. Defaults to case-insensitive substring match on the item's value
   * (or id).
   */
  filter?: (value: string, search: string) => boolean;
}

/** Provides command palette state behavior. */
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
  const filter = filterProp ?? matchesSearch;
  const [isOpen, setIsOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: false,
    onChange: onOpenChange,
  });
  const [search, setSearch] = useControllableState({
    value: controlledSearch,
    defaultValue: "",
    onChange: controlledOnSearchChange,
  });
  const [highlighted, setHighlighted, isHighlightedControlled] = useControllableState<
    string | null
  >({
    value: controlledHighlighted,
    controlled: controlledHighlighted !== undefined,
    defaultValue: null,
    onChange: onHighlightChange,
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteId = useId();

  const { itemIds, getItemOnSelect, registerItem, unregisterItem } = useCommandPaletteItemRegistry({
    listRef,
    enabled: isOpen,
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setSearch("");
      setIsOpen(next);
    },
    [setIsOpen, setSearch],
  );

  const handleActivate = useCallback(
    (id: string) => {
      getItemOnSelect(id)?.();
      onActivate?.(id);
      handleOpenChange(false);
    },
    [getItemOnSelect, handleOpenChange, onActivate],
  );

  const effectiveHighlighted = getEffectiveHighlighted(
    highlighted,
    itemIds,
    isHighlightedControlled,
  );

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    highlighted: effectiveHighlighted,
    onHighlightChange: setHighlighted,
    onEnter: handleActivate,
    enabled: isOpen,
    scopeToContainer: true,
  });

  const highlightedIndex =
    effectiveHighlighted === null ? -1 : itemIds.indexOf(effectiveHighlighted);

  // Not memoized: useNavigation hands back a fresh onKeyDown every render, so a
  // useMemo over this object could never hit.
  return {
    open: isOpen,
    onOpenChange: handleOpenChange,
    highlighted: effectiveHighlighted,
    onHighlightChange: setHighlighted,
    onActivate: handleActivate,
    search,
    onSearchChange: setSearch,
    shouldFilter,
    filter,
    itemCount: itemIds.length,
    highlightedPosition: highlightedIndex === -1 ? null : highlightedIndex + 1,
    listId: `${paletteId}-list`,
    listRef,
    inputRef,
    navKeyDown,
    registerItem,
    unregisterItem,
  };
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
