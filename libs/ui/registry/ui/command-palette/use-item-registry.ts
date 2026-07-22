"use client";

import { type RefObject, useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  isSelectableItemEligible,
  sortSelectableCollectionItems,
} from "@/lib/selectable-collection";

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

/** Options for command palette item registration. */
export interface UseCommandPaletteItemRegistryOptions {
  listRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
}

/** Owns registered items, DOM-order sorting, and eligibility for the palette list. */
export function useCommandPaletteItemRegistry({
  listRef,
  enabled,
}: UseCommandPaletteItemRegistryOptions) {
  const [registeredItems, setRegisteredItems] = useState<CommandPaletteItemRegistration[]>([]);

  // hidden/inert/aria-hidden toggles do not change the registered items array, so
  // force a fresh reference on those mutations or activeItems keeps stale eligibility.
  useLayoutEffect(() => {
    if (!enabled) return;
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
  }, [enabled, listRef]);

  const activeItems = useMemo(
    () => sortSelectableCollectionItems(registeredItems).filter(isSelectableItemEligible),
    [registeredItems],
  );

  const itemCallbacks = useMemo(
    () => new Map(activeItems.map((item) => [item.id, item.onSelect])),
    [activeItems],
  );

  const itemIds = useMemo(() => activeItems.map((item) => item.id), [activeItems]);

  const getItemOnSelect = useCallback(
    (id: string) => itemCallbacks.get(id),
    [itemCallbacks],
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

  return {
    itemIds,
    getItemOnSelect,
    registerItem,
    unregisterItem,
  };
}
