"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useNavigation } from "@/hooks/use-navigation";
import { encodeDomIdSegment } from "@/lib/dom-id";
import { matchesSearch } from "@/lib/search";
import {
  isSelectableItemEligible,
  sortSelectableCollectionItems,
} from "@/lib/selectable-collection";

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
  itemCount: number;
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

const defaultFilter = matchesSearch;

function areCommandPaletteItemsEqual(
  current: CommandPaletteItemRegistration,
  next: CommandPaletteItemRegistration,
): boolean {
  return (
    current.registrationId === next.registrationId &&
    current.id === next.id &&
    current.value === next.value &&
    current.disabled === next.disabled &&
    current.onSelect === next.onSelect &&
    current.element === next.element
  );
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
  const [registeredItems, setRegisteredItems] = useState<CommandPaletteItemRegistration[]>([]);
  const filter = filterProp ?? defaultFilter;
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

  // hidden/inert/aria-hidden toggles do not change the registered items array, so
  // force a fresh reference on those mutations or activeItems keeps stale eligibility.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    const view = list?.ownerDocument.defaultView;
    if (!list || !view?.MutationObserver) return;

    const attributeFilter = [
      "hidden",
      "inert",
      "aria-hidden",
      "class",
      "style",
      "disabled",
      "open",
    ];
    // Keep collection eligibility invalidation aligned with lib/selectable-collection.ts.
    const observer = new view.MutationObserver(() => {
      setRegisteredItems((current) => [...current]);
    });
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter,
    });

    let ancestor = list.parentElement;
    while (ancestor) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter,
      });
      ancestor = ancestor.parentElement;
    }

    return () => observer.disconnect();
  }, [isOpen]);

  const activeItems = useMemo(
    () => sortSelectableCollectionItems(registeredItems).filter(isSelectableItemEligible),
    [registeredItems],
  );
  const itemCallbacks = useMemo(
    () => new Map(activeItems.map((item) => [item.id, item.onSelect])),
    [activeItems],
  );
  const itemIds = useMemo(() => activeItems.map((item) => item.id), [activeItems]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setSearch("");
      setIsOpen(next);
    },
    [setIsOpen, setSearch],
  );

  const handleActivate = useCallback(
    (id: string) => {
      itemCallbacks.get(id)?.();
      onActivate?.(id);
      handleOpenChange(false);
    },
    [handleOpenChange, itemCallbacks, onActivate],
  );

  const registerItem = useCallback((item: CommandPaletteItemRegistration) => {
    setRegisteredItems((current) => {
      const existingIndex = current.findIndex(
        (candidate) => candidate.registrationId === item.registrationId,
      );
      if (existingIndex === -1) return [...current, item];
      const existingItem = current[existingIndex];
      if (existingItem === undefined) return current;
      if (areCommandPaletteItemsEqual(existingItem, item)) return current;

      const next = [...current];
      next[existingIndex] = item;
      return next;
    });
  }, []);

  const unregisterItem = useCallback((registrationId: string) => {
    setRegisteredItems((current) => {
      const existingIndex = current.findIndex((item) => item.registrationId === registrationId);
      if (existingIndex === -1) return current;

      const next = [...current];
      next.splice(existingIndex, 1);
      return next;
    });
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

  return useMemo(
    () => ({
      open: isOpen,
      onOpenChange: handleOpenChange,
      highlighted: getEffectiveHighlighted(highlighted, itemIds, isHighlightedControlled),
      onHighlightChange: setHighlighted,
      onActivate: handleActivate,
      search,
      onSearchChange: setSearch,
      shouldFilter,
      filter,
      itemCount: itemIds.length,
      listId: `${paletteId}-list`,
      listRef,
      inputRef,
      navKeyDown,
      registerItem,
      unregisterItem,
    }),
    [
      isOpen,
      handleOpenChange,
      handleActivate,
      highlighted,
      itemIds,
      isHighlightedControlled,
      setHighlighted,
      search,
      setSearch,
      shouldFilter,
      filter,
      paletteId,
      navKeyDown,
      registerItem,
      unregisterItem,
    ],
  );
}

/** Selectable item with icon, shortcut, tone, value. */
export interface CommandPaletteItemMetadata {
  /** Stable unique id used for highlight state and aria-activedescendant. */
  id: string;
  /** Searchable text. Defaults to id when omitted. */
  value: string;
  /** Disable activation and skip in keyboard navigation. */
  disabled: boolean;
  /** Called when the item is activated. Runs before CommandPalette.onActivate. */
  onSelect?: () => void;
}

export interface CommandPaletteItemRegistration extends CommandPaletteItemMetadata {
  /** DOM id for registration. */
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
