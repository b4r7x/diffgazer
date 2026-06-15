"use client";

import { type RefObject, useCallback, useLayoutEffect, useState } from "react";

/** Registered item data for a selectable collection that needs DOM-order navigation. */
export interface SelectableCollectionItem {
  /** Stable registration id for the rendered item. */
  id: string;
  /** Public value emitted by the collection. */
  value: string;
  /** Whether the item is disabled for selection. */
  disabled: boolean;
  /** Mounted DOM element used for document-order sorting. */
  element: HTMLElement | null;
}

const DOCUMENT_POSITION_PRECEDING = 2;
const DOCUMENT_POSITION_FOLLOWING = 4;

function compareSelectableItems(a: SelectableCollectionItem, b: SelectableCollectionItem) {
  if (!a.element || !b.element || a.element === b.element) return 0;

  const position = a.element.compareDocumentPosition(b.element);
  if (position & DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function areSelectableItemsEqual(a: SelectableCollectionItem[], b: SelectableCollectionItem[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return (
        other?.id === item.id &&
        other.value === item.value &&
        other.disabled === item.disabled &&
        other.element === item.element
      );
    })
  );
}

/** Sorts registered items by their current DOM order. */
export function sortSelectableCollectionItems<T extends SelectableCollectionItem>(items: T[]) {
  return [...items].sort(compareSelectableItems);
}

/** Returns enabled mounted items in DOM order, or an empty array when the collection is disabled. */
export function getEnabledSelectableCollectionItems(
  items: SelectableCollectionItem[],
  disabled: boolean,
) {
  if (disabled) return [];
  return sortSelectableCollectionItems(items).filter(
    (item) => !item.disabled && item.element !== null,
  );
}

/** Finds the enabled item for a public value. */
export function getSelectableCollectionItemByValue(
  items: SelectableCollectionItem[],
  value: string | null | undefined,
): SelectableCollectionItem | null {
  if (value == null) return null;
  return items.find((item) => item.value === value && !item.disabled) ?? null;
}

/** Resolves a value only when it belongs to an enabled registered item. */
export function getSelectableCollectionItemValue(
  items: SelectableCollectionItem[],
  value: string | null | undefined,
): string | null {
  return getSelectableCollectionItemByValue(items, value)?.value ?? null;
}

/** Resolves the first enabled registered item from preferred values, then falls back to the first enabled item. */
export function resolveSelectableCollectionItem(
  items: SelectableCollectionItem[],
  ...values: Array<string | null | undefined>
): SelectableCollectionItem | null {
  const enabledItems = sortSelectableCollectionItems(items).filter(
    (item) => !item.disabled && item.element !== null,
  );

  for (const value of values) {
    const item = getSelectableCollectionItemByValue(enabledItems, value);
    if (item) return item;
  }

  return enabledItems[0] ?? null;
}

/** Resolves the public value for the first enabled registered item from preferred values. */
export function resolveSelectableCollectionItemValue(
  items: SelectableCollectionItem[],
  ...values: Array<string | null | undefined>
): string | null {
  return resolveSelectableCollectionItem(items, ...values)?.value ?? null;
}

/** Tracks registered selectable items and keeps them sorted by DOM order. */
export function useSelectableCollection(containerRef: RefObject<HTMLElement | null>) {
  const [items, setItems] = useState<SelectableCollectionItem[]>([]);

  const syncOrder = useCallback(() => {
    setItems((current) => {
      const sorted = sortSelectableCollectionItems(current);
      return areSelectableItemsEqual(current, sorted) ? current : sorted;
    });
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const View = container?.ownerDocument.defaultView;
    if (!container || !View?.MutationObserver) return;

    const observer = new View.MutationObserver(syncOrder);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [containerRef, syncOrder]);

  const registerItem = useCallback(
    (itemId: string, value: string, disabled: boolean, element: HTMLElement | null) => {
      setItems((current) => {
        const existingIndex = current.findIndex((item) => item.id === itemId);
        const nextItem = { id: itemId, value, disabled, element };
        const next = existingIndex === -1 ? [...current, nextItem] : [...current];
        if (existingIndex !== -1) next[existingIndex] = nextItem;

        const sorted = sortSelectableCollectionItems(next);
        return areSelectableItemsEqual(current, sorted) ? current : sorted;
      });
    },
    [],
  );

  const unregisterItem = useCallback((itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  return {
    items,
    registerItem,
    unregisterItem,
  };
}
