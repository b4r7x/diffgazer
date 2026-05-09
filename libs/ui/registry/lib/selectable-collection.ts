"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export interface SelectableCollectionItem {
  id: string;
  value: string;
  disabled: boolean;
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

function areSelectableItemsEqual(
  a: SelectableCollectionItem[],
  b: SelectableCollectionItem[],
) {
  return a.length === b.length
    && a.every((item, index) => {
      const other = b[index];
      return other?.id === item.id
        && other.value === item.value
        && other.disabled === item.disabled
        && other.element === item.element;
    });
}

export function sortSelectableCollectionItems<T extends SelectableCollectionItem>(items: T[]) {
  return [...items].sort(compareSelectableItems);
}

export function getEnabledSelectableCollectionItems(
  items: SelectableCollectionItem[],
  disabled: boolean,
) {
  if (disabled) return [];
  return sortSelectableCollectionItems(items).filter((item) => !item.disabled && item.element !== null);
}

export function getSelectableCollectionItemByValue(
  items: SelectableCollectionItem[],
  value: string | null | undefined,
) {
  if (value == null) return null;
  return items.find((item) => item.value === value && !item.disabled) ?? null;
}

export function getSelectableCollectionItemValue(
  items: SelectableCollectionItem[],
  value: string | null | undefined,
) {
  return getSelectableCollectionItemByValue(items, value)?.value ?? null;
}

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

  const registerItem = useCallback((
    itemId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === itemId);
      const nextItem = { id: itemId, value, disabled, element };
      const next = existingIndex === -1 ? [...current, nextItem] : [...current];
      if (existingIndex !== -1) next[existingIndex] = nextItem;

      const sorted = sortSelectableCollectionItems(next);
      return areSelectableItemsEqual(current, sorted) ? current : sorted;
    });
  }, []);

  const unregisterItem = useCallback((itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  return {
    items,
    registerItem,
    unregisterItem,
  };
}
