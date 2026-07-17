"use client";

import { isReachable } from "@diffgazer/keys";
import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";

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

interface DocumentReachabilityObserver {
  subscribers: Set<() => void>;
  disconnect: () => void;
}

interface ViewReachabilityInstrumentation {
  documents: Map<Document, () => void>;
  disconnect: () => void;
}

interface MediaQuerySubscription {
  mediaQuery: MediaQueryList;
  listener: () => void;
}

const documentReachabilityObservers = new WeakMap<Document, DocumentReachabilityObserver>();
const viewReachabilityInstrumentations = new WeakMap<Window, ViewReachabilityInstrumentation>();

function restoreValueDescriptor(
  target: object,
  key: PropertyKey,
  wrappedValue: unknown,
  descriptor: PropertyDescriptor,
) {
  const current = Object.getOwnPropertyDescriptor(target, key);
  if (current?.value === wrappedValue) Object.defineProperty(target, key, descriptor);
}

function findPropertyDescriptor(target: object, key: PropertyKey) {
  let owner: object | null = target;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor) return { owner, descriptor };
    owner = Object.getPrototypeOf(owner);
  }
  return null;
}

function createViewReachabilityInstrumentation(
  View: Window & typeof globalThis,
): ViewReachabilityInstrumentation {
  const documents = new Map<Document, () => void>();
  const notifyDocuments = () => {
    for (const notify of documents.values()) notify();
  };
  const restores: Array<() => void> = [];
  const sheetPrototype = View.CSSStyleSheet?.prototype;

  if (sheetPrototype) {
    const insertRuleProperty = findPropertyDescriptor(sheetPrototype, "insertRule");
    const insertRuleDescriptor = insertRuleProperty?.descriptor;
    const insertRule = sheetPrototype.insertRule;
    const wrappedInsertRule = function (this: CSSStyleSheet, rule: string, index?: number): number {
      const result = insertRule.call(this, rule, index);
      notifyDocuments();
      return result;
    };
    if (insertRuleProperty && insertRuleDescriptor) {
      Object.defineProperty(insertRuleProperty.owner, "insertRule", {
        ...insertRuleDescriptor,
        value: wrappedInsertRule,
      });
      restores.push(() =>
        restoreValueDescriptor(
          insertRuleProperty.owner,
          "insertRule",
          wrappedInsertRule,
          insertRuleDescriptor,
        ),
      );
    }

    const deleteRuleProperty = findPropertyDescriptor(sheetPrototype, "deleteRule");
    const deleteRuleDescriptor = deleteRuleProperty?.descriptor;
    const deleteRule = sheetPrototype.deleteRule;
    const wrappedDeleteRule = function (this: CSSStyleSheet, index: number): void {
      deleteRule.call(this, index);
      notifyDocuments();
    };
    if (deleteRuleProperty && deleteRuleDescriptor) {
      Object.defineProperty(deleteRuleProperty.owner, "deleteRule", {
        ...deleteRuleDescriptor,
        value: wrappedDeleteRule,
      });
      restores.push(() =>
        restoreValueDescriptor(
          deleteRuleProperty.owner,
          "deleteRule",
          wrappedDeleteRule,
          deleteRuleDescriptor,
        ),
      );
    }

    const replaceSyncProperty = findPropertyDescriptor(sheetPrototype, "replaceSync");
    const replaceSyncDescriptor = replaceSyncProperty?.descriptor;
    const replaceSync = sheetPrototype.replaceSync;
    if (replaceSyncProperty && replaceSyncDescriptor && replaceSync) {
      const wrappedReplaceSync = function (this: CSSStyleSheet, text: string): void {
        replaceSync.call(this, text);
        notifyDocuments();
      };
      Object.defineProperty(replaceSyncProperty.owner, "replaceSync", {
        ...replaceSyncDescriptor,
        value: wrappedReplaceSync,
      });
      restores.push(() =>
        restoreValueDescriptor(
          replaceSyncProperty.owner,
          "replaceSync",
          wrappedReplaceSync,
          replaceSyncDescriptor,
        ),
      );
    }

    const replaceProperty = findPropertyDescriptor(sheetPrototype, "replace");
    const replaceDescriptor = replaceProperty?.descriptor;
    const replace = sheetPrototype.replace;
    if (replaceProperty && replaceDescriptor && replace) {
      const wrappedReplace = function (this: CSSStyleSheet, text: string): Promise<CSSStyleSheet> {
        const result = replace.call(this, text);
        void result.then(notifyDocuments, () => undefined);
        return result;
      };
      Object.defineProperty(replaceProperty.owner, "replace", {
        ...replaceDescriptor,
        value: wrappedReplace,
      });
      restores.push(() =>
        restoreValueDescriptor(replaceProperty.owner, "replace", wrappedReplace, replaceDescriptor),
      );
    }
  }

  const adoptedStyleSheetsProperty = findPropertyDescriptor(
    View.Document.prototype,
    "adoptedStyleSheets",
  );
  const adoptedStyleSheetsSetter = adoptedStyleSheetsProperty?.descriptor.set;
  if (adoptedStyleSheetsProperty && adoptedStyleSheetsSetter) {
    const { descriptor, owner } = adoptedStyleSheetsProperty;
    const wrappedSetter = function (this: Document, sheets: CSSStyleSheet[]): void {
      adoptedStyleSheetsSetter.call(this, sheets);
      documents.get(this)?.();
    };
    Object.defineProperty(owner, "adoptedStyleSheets", { ...descriptor, set: wrappedSetter });
    restores.push(() => {
      const current = Object.getOwnPropertyDescriptor(owner, "adoptedStyleSheets");
      if (current?.set === wrappedSetter)
        Object.defineProperty(owner, "adoptedStyleSheets", descriptor);
    });
  }

  return {
    documents,
    disconnect: () => {
      for (const restore of restores.reverse()) restore();
    },
  };
}

function subscribeToViewReachability(document: Document, notify: () => void): () => void {
  const View = document.defaultView;
  if (!View) return () => {};

  let instrumentation = viewReachabilityInstrumentations.get(View);
  if (!instrumentation) {
    instrumentation = createViewReachabilityInstrumentation(View);
    viewReachabilityInstrumentations.set(View, instrumentation);
  }
  instrumentation.documents.set(document, notify);

  return () => {
    instrumentation?.documents.delete(document);
    if (instrumentation?.documents.size !== 0) return;
    instrumentation.disconnect();
    viewReachabilityInstrumentations.delete(View);
  };
}

function isMediaList(value: unknown): value is MediaList {
  return (
    typeof value === "object" &&
    value !== null &&
    "mediaText" in value &&
    typeof value.mediaText === "string"
  );
}

function hasMedia(rule: CSSRule): rule is CSSRule & { media: MediaList } {
  return "media" in rule && isMediaList(rule.media);
}

function hasNestedRules(rule: CSSRule): rule is CSSRule & { cssRules: CSSRuleList } {
  return "cssRules" in rule && rule.cssRules instanceof Object && "length" in rule.cssRules;
}

function collectMediaQueriesFromRules(rules: CSSRuleList, queries: Set<string>): void {
  for (const rule of rules) {
    if (hasMedia(rule) && rule.media.mediaText) queries.add(rule.media.mediaText);
    if (hasNestedRules(rule)) collectMediaQueriesFromRules(rule.cssRules, queries);
  }
}

function collectMediaQueries(document: Document): Set<string> {
  const queries = new Set<string>();
  const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])];
  for (const sheet of sheets) {
    if (sheet.media.mediaText) queries.add(sheet.media.mediaText);
    try {
      collectMediaQueriesFromRules(sheet.cssRules, queries);
    } catch {
      // Cross-origin stylesheets intentionally keep their rule lists opaque.
    }
  }
  return queries;
}

function subscribeToDocumentReachability(document: Document, subscriber: () => void): () => void {
  let entry = documentReachabilityObservers.get(document);
  if (!entry) {
    const View = document.defaultView;
    if (!View) return () => {};

    const subscribers = new Set<() => void>();
    const mediaQuerySubscriptions = new Map<string, MediaQuerySubscription>();
    let isActive = true;
    let isScheduled = false;

    const refreshMediaQueries = () => {
      if (!View.matchMedia) return;
      const queries = collectMediaQueries(document);
      for (const [query, subscription] of mediaQuerySubscriptions) {
        if (queries.has(query)) continue;
        subscription.mediaQuery.removeEventListener("change", subscription.listener);
        mediaQuerySubscriptions.delete(query);
      }
      for (const query of queries) {
        if (mediaQuerySubscriptions.has(query)) continue;
        const mediaQuery = View.matchMedia(query);
        const listener = () => schedule();
        mediaQuery.addEventListener("change", listener);
        mediaQuerySubscriptions.set(query, { mediaQuery, listener });
      }
    };
    const flush = () => {
      isScheduled = false;
      if (!isActive) return;
      refreshMediaQueries();
      for (const callback of subscribers) callback();
    };
    const schedule = () => {
      if (!isActive || isScheduled) return;
      isScheduled = true;
      View.queueMicrotask(flush);
    };
    const observer = new View.MutationObserver(schedule);
    if (document.head) {
      observer.observe(document.head, {
        attributes: true,
        attributeFilter: ["disabled", "href", "media", "rel", "style"],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    const handleLoad = (event: Event) => {
      const target = event.target;
      if (!(target instanceof View.Element)) return;
      if (target.tagName === "LINK" || target.tagName === "STYLE") schedule();
    };
    View.addEventListener("resize", schedule);
    document.addEventListener("load", handleLoad, true);
    document.addEventListener("visibilitychange", schedule);
    const unsubscribeView = subscribeToViewReachability(document, schedule);
    refreshMediaQueries();

    entry = {
      subscribers,
      disconnect: () => {
        isActive = false;
        observer.disconnect();
        View.removeEventListener("resize", schedule);
        document.removeEventListener("load", handleLoad, true);
        document.removeEventListener("visibilitychange", schedule);
        for (const subscription of mediaQuerySubscriptions.values()) {
          subscription.mediaQuery.removeEventListener("change", subscription.listener);
        }
        mediaQuerySubscriptions.clear();
        unsubscribeView();
      },
    };
    documentReachabilityObservers.set(document, entry);
  }

  entry.subscribers.add(subscriber);
  return () => {
    entry?.subscribers.delete(subscriber);
    if (entry?.subscribers.size !== 0) return;
    entry.disconnect();
    documentReachabilityObservers.delete(document);
  };
}

/** True when a disabled ancestor fieldset applies to the element. */
export function isElementDisabledByFieldset(element: HTMLElement): boolean {
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.tagName === "FIELDSET" && ancestor.hasAttribute("disabled")) {
      const firstLegend = Array.from(ancestor.children).find((child) => child.tagName === "LEGEND");
      if (!firstLegend?.contains(element)) return true;
    }
    ancestor = ancestor.parentElement;
  }
  return false;
}

function getAncestorFieldsets(element: HTMLElement): HTMLElement[] {
  const fieldsets: HTMLElement[] = [];
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.tagName === "FIELDSET") fieldsets.push(ancestor);
    ancestor = ancestor.parentElement;
  }
  return fieldsets;
}

/** Tracks native disabled-fieldset inheritance, including the first-legend exception. */
export function useFieldsetDisabled(ref: RefObject<HTMLElement | null>): boolean {
  const [isDisabled, setIsDisabled] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    const View = element?.ownerDocument.defaultView;
    if (!element || !View?.MutationObserver) return;

    const update = () => setIsDisabled(isElementDisabledByFieldset(element));
    const observer = new View.MutationObserver(update);
    for (const fieldset of getAncestorFieldsets(element)) {
      observer.observe(fieldset, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
        subtree: true,
      });
    }
    update();
    return () => observer.disconnect();
  }, [ref]);

  return isDisabled;
}

/** True when self-or-ancestor state removes an element from keyboard reach. */
export function isSelectableElementSkipped(element: HTMLElement): boolean {
  return !isReachable(element);
}

/** True when an item is enabled, mounted, and reachable by keyboard. */
export function isSelectableItemEligible(item: SelectableCollectionItem): boolean {
  return (
    !item.disabled &&
    item.element !== null &&
    !isElementDisabledByFieldset(item.element) &&
    !isSelectableElementSkipped(item.element)
  );
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
  const enabledItems = sortSelectableCollectionItems(items).filter(isSelectableItemEligible);

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
  const [registeredItems, setRegisteredItems] = useState<SelectableCollectionItem[]>([]);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const eligibilitySignatureRef = useRef("");

  const syncCollection = useCallback(() => {
    setRegisteredItems((current) => {
      const sorted = sortSelectableCollectionItems(current);
      const signature = sorted
        .map((item) => `${item.id}:${isSelectableItemEligible(item) ? "1" : "0"}`)
        .join("|");
      if (
        signature === eligibilitySignatureRef.current &&
        areSelectableItemsEqual(current, sorted)
      ) {
        return current;
      }
      eligibilitySignatureRef.current = signature;
      return sorted;
    });
  }, []);

  useLayoutEffect(() => {
    setContainer((current) => (current === containerRef.current ? current : containerRef.current));
  });

  useLayoutEffect(() => {
    const View = container?.ownerDocument.defaultView;
    if (!container || !View?.MutationObserver) return;

    const observer = new View.MutationObserver(syncCollection);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "class", "style", "disabled", "open"],
    });

    let ancestor = container.parentElement;
    while (ancestor) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["hidden", "inert", "aria-hidden", "class", "style", "disabled", "open"],
      });
      ancestor = ancestor.parentElement;
    }

    const unsubscribeDocument = subscribeToDocumentReachability(
      container.ownerDocument,
      syncCollection,
    );
    syncCollection();

    return () => {
      observer.disconnect();
      unsubscribeDocument();
    };
  }, [container, syncCollection]);

  const eligibilitySignature = registeredItems
    .map((item) => `${item.id}:${isSelectableItemEligible(item) ? "1" : "0"}`)
    .join("|");

  useLayoutEffect(() => {
    eligibilitySignatureRef.current = eligibilitySignature;
  }, [eligibilitySignature]);

  useLayoutEffect(() => {
    const View = container?.ownerDocument.defaultView;
    if (!container || !View?.ResizeObserver) return;

    const observer = new View.ResizeObserver(syncCollection);
    observer.observe(container);
    for (const item of registeredItems) {
      if (item.element && container.contains(item.element)) observer.observe(item.element);
    }
    return () => observer.disconnect();
  }, [container, registeredItems, syncCollection]);

  const registerItem = useCallback(
    (itemId: string, value: string, disabled: boolean, element: HTMLElement | null) => {
      setRegisteredItems((current) => {
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
    setRegisteredItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const items = sortSelectableCollectionItems(registeredItems).filter(
    (item) =>
      item.element !== null &&
      container?.contains(item.element) === true &&
      !isSelectableElementSkipped(item.element),
  );

  return {
    items,
    registerItem,
    unregisterItem,
  };
}
