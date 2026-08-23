"use client";

import { type RefObject, useCallback, useMemo, useState } from "react";
import { useSelectableCollection } from "@/lib/selectable-collection";

/** Registration payload sent by CommandPalette.Item on mount and on every change. */
export interface CommandPaletteItemRegistration {
  /** Stable registration id owned by the rendered item. */
  registrationId: string;
  /** Public item id used for highlight state and aria-activedescendant. */
  id: string;
  /** Disable activation and skip in keyboard navigation. */
  disabled: boolean;
  /** Called when the item is activated. Runs before CommandPalette.onActivate. */
  onSelect?: () => void;
  /** Mounted DOM element, or null while the item is filtered out. */
  element: HTMLElement | null;
}

export interface UseCommandPaletteItemRegistryOptions {
  listRef: RefObject<HTMLDivElement | null>;
}

/**
 * Registers palette rows in the shared selectable collection and keeps an
 * `onSelect` sidecar beside it, the way Stepper keeps its step metadata.
 * `renderedIds` is every mounted row in the list (disabled rows included) and
 * `itemIds` is the keyboard-reachable subset.
 */
export function useCommandPaletteItemRegistry({ listRef }: UseCommandPaletteItemRegistryOptions) {
  const [onSelectByRegistration, setOnSelectByRegistration] = useState<
    Record<string, (() => void) | undefined>
  >({});
  const {
    items: renderedItems,
    eligibleItems,
    registerItem: registerCollectionItem,
    unregisterItem: unregisterCollectionItem,
  } = useSelectableCollection(listRef);

  const registerItem = useCallback(
    (item: CommandPaletteItemRegistration) => {
      setOnSelectByRegistration((current) =>
        current[item.registrationId] === item.onSelect
          ? current
          : { ...current, [item.registrationId]: item.onSelect },
      );
      registerCollectionItem(item.registrationId, item.id, item.disabled, item.element);
    },
    [registerCollectionItem],
  );

  const unregisterItem = useCallback(
    (registrationId: string) => {
      setOnSelectByRegistration((current) => {
        if (!(registrationId in current)) return current;
        const { [registrationId]: _removed, ...rest } = current;
        return rest;
      });
      unregisterCollectionItem(registrationId);
    },
    [unregisterCollectionItem],
  );

  const renderedIds = useMemo(() => renderedItems.map((item) => item.value), [renderedItems]);
  const itemIds = useMemo(() => eligibleItems.map((item) => item.value), [eligibleItems]);
  const itemCallbacks = useMemo(
    () => new Map(eligibleItems.map((item) => [item.value, onSelectByRegistration[item.id]])),
    [eligibleItems, onSelectByRegistration],
  );

  const getItemOnSelect = useCallback((id: string) => itemCallbacks.get(id), [itemCallbacks]);

  return { itemIds, renderedIds, getItemOnSelect, registerItem, unregisterItem };
}
