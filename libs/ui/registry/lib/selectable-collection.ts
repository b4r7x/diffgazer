"use client";

import { isInsideDisabledFieldset, isReachable } from "@diffgazer/keys";
import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";
import { observeSelectableEligibility } from "./selectable-collection-observer";

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

/** True when self-or-ancestor state removes an element from keyboard reach. */
export function isSelectableElementSkipped(element: HTMLElement): boolean {
  return !isReachable(element);
}

/**
 * SSR-seed mirror of isSelectableElementSkipped: answers the same question from
 * static child props, before any element mounts.
 */
export function isSeedElementSkipped(props: {
  hidden?: boolean;
  inert?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

/** Visibility and keyboard-eligibility flags computed for a registered item. */
interface SelectableItemStatus {
  isVisible: boolean;
  isEligible: boolean;
}

function getSelectableItemStatus(item: SelectableCollectionItem): SelectableItemStatus {
  if (item.element === null) return { isVisible: false, isEligible: false };

  const isSkipped = isSelectableElementSkipped(item.element);
  const isDisabledByFieldset = isInsideDisabledFieldset(item.element);
  return {
    isVisible: !isSkipped,
    isEligible: !item.disabled && !isDisabledByFieldset && !isSkipped,
  };
}

/** True when an item is enabled, mounted, and reachable by keyboard. */
export function isSelectableItemEligible(item: SelectableCollectionItem): boolean {
  return getSelectableItemStatus(item).isEligible;
}

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
  return sortSelectableCollectionItems(items).filter(isSelectableItemEligible);
}

/** Finds the enabled item for a public value. */
export function getSelectableCollectionItemByValue(
  items: SelectableCollectionItem[],
  value: string | null | undefined,
): SelectableCollectionItem | null {
  if (value == null) return null;
  return items.find((item) => item.value === value && !item.disabled) ?? null;
}

/** Resolves the first enabled registered item from preferred values, then falls back to the first enabled item. */
export function resolveSelectableCollectionItem(
  items: SelectableCollectionItem[],
  ...values: Array<string | null | undefined>
): SelectableCollectionItem | null {
  const enabledItems = sortSelectableCollectionItems(items).filter(isSelectableItemEligible);

  for (const value of values) {
    const item = getSelectableCollectionItemByValue(enabledItems, value);
    if (item) return item;
  }

  return enabledItems[0] ?? null;
}

interface SelectableCollectionState {
  registeredItems: SelectableCollectionItem[];
  items: SelectableCollectionItem[];
  eligibleItems: SelectableCollectionItem[];
  eligibilitySignature: string;
}

const EMPTY_COLLECTION_STATE: SelectableCollectionState = {
  registeredItems: [],
  items: [],
  eligibleItems: [],
  eligibilitySignature: "",
};

function createCollectionState(
  items: SelectableCollectionItem[],
  container: HTMLElement | null,
  previous: SelectableCollectionState,
): SelectableCollectionState {
  const sorted = sortSelectableCollectionItems(items);
  const visibleItems: SelectableCollectionItem[] = [];
  const eligibility: boolean[] = [];
  const eligibleItems: SelectableCollectionItem[] = [];

  for (const item of sorted) {
    const status = getSelectableItemStatus(item);
    const isInContainer = item.element !== null && container?.contains(item.element) === true;
    const visible = status.isVisible && isInContainer;
    const eligible = status.isEligible && isInContainer;
    eligibility.push(eligible);
    if (visible) visibleItems.push(item);
    if (eligible) eligibleItems.push(item);
  }

  const nextRegisteredItems = areSelectableItemsEqual(previous.registeredItems, sorted)
    ? previous.registeredItems
    : sorted;
  const nextItems = areSelectableItemsEqual(previous.items, visibleItems)
    ? previous.items
    : visibleItems;
  const nextEligibleItems = areSelectableItemsEqual(previous.eligibleItems, eligibleItems)
    ? previous.eligibleItems
    : eligibleItems;
  const eligibilitySignature = sorted
    .map((item, index) => `${item.id}:${eligibility[index] ? "1" : "0"}`)
    .join("|");

  if (
    previous.registeredItems === nextRegisteredItems &&
    previous.items === nextItems &&
    previous.eligibleItems === nextEligibleItems &&
    previous.eligibilitySignature === eligibilitySignature
  ) {
    return previous;
  }

  return {
    registeredItems: nextRegisteredItems,
    items: nextItems,
    eligibleItems: nextEligibleItems,
    eligibilitySignature,
  };
}

/** Tracks registered selectable items and keeps them sorted by DOM order. */
export function useSelectableCollection(containerRef: RefObject<HTMLElement | null>) {
  const [collectionState, setCollectionState] = useState(EMPTY_COLLECTION_STATE);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const collectionStateRef = useRef(EMPTY_COLLECTION_STATE);
  const registeredItemsRef = useRef(new Map<string, SelectableCollectionItem>());
  const commitScheduledRef = useRef(false);

  // createCollectionState reads the DOM (getComputedStyle, compareDocumentPosition),
  // so it runs here before setState; setState updaters must stay pure under StrictMode replay.
  // The container comes from the ref, not the state mirror below: a commit deferred to a
  // microtask must see the container mounted since it was scheduled, not the one captured
  // with it, or the first registration pass commits an empty collection after mount.
  const commitCollectionState = useCallback(() => {
    const items = [...registeredItemsRef.current.values()];
    const next = createCollectionState(items, containerRef.current, collectionStateRef.current);
    collectionStateRef.current = next;
    setCollectionState(next);
  }, [containerRef]);

  const scheduleCommit = useCallback(() => {
    if (commitScheduledRef.current) return;
    commitScheduledRef.current = true;
    const View = containerRef.current?.ownerDocument.defaultView ?? globalThis;
    View.queueMicrotask(() => {
      if (!commitScheduledRef.current) return;
      commitScheduledRef.current = false;
      commitCollectionState();
    });
  }, [commitCollectionState, containerRef]);

  const syncCollection = useCallback(() => {
    // Observer-driven changes stay synchronous. When they arrive before a pending
    // registration microtask, this commit includes those registrations and cancels
    // the redundant deferred reconciliation.
    commitScheduledRef.current = false;
    commitCollectionState();
  }, [commitCollectionState]);

  // Ref-to-state promotion with equality bail; must observe every render.
  useLayoutEffect(() => {
    setContainer((current) => (current === containerRef.current ? current : containerRef.current));
  });

  useLayoutEffect(() => {
    if (!container) return;

    const stopObserving = observeSelectableEligibility(container, syncCollection);
    syncCollection();

    return stopObserving;
  }, [container, syncCollection]);

  useLayoutEffect(() => {
    const View = container?.ownerDocument.defaultView;
    if (!container || !View?.ResizeObserver) return;

    const observer = new View.ResizeObserver(syncCollection);
    observer.observe(container);
    for (const item of collectionState.items) {
      if (item.element && container.contains(item.element)) observer.observe(item.element);
    }
    return () => observer.disconnect();
  }, [collectionState.items, container, syncCollection]);

  // Registrations that land in a commit this collection also rendered reconcile
  // here, inside the commit phase, so roving tabIndex and active-descendant are
  // never one paint behind. The scheduled microtask covers the rest: a
  // registration from an observer callback schedules no render to drain it.
  useLayoutEffect(() => {
    if (!container || !commitScheduledRef.current) return;
    commitScheduledRef.current = false;
    commitCollectionState();
  });

  const registerItem = useCallback(
    (itemId: string, value: string, disabled: boolean, element: HTMLElement | null) => {
      const existing = registeredItemsRef.current.get(itemId);
      const nextItem = { id: itemId, value, disabled, element };
      if (
        existing?.value === value &&
        existing.disabled === disabled &&
        existing.element === element
      ) {
        return;
      }

      registeredItemsRef.current.set(itemId, nextItem);
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const unregisterItem = useCallback(
    (itemId: string) => {
      if (!registeredItemsRef.current.delete(itemId)) return;
      scheduleCommit();
    },
    [scheduleCommit],
  );

  return {
    items: collectionState.items,
    registeredItems: collectionState.registeredItems,
    eligibleItems: collectionState.eligibleItems,
    registerItem,
    unregisterItem,
  };
}
