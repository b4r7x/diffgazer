"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

type OutsideClickEntry = {
  id: symbol;
  ref: RefObject<HTMLElement | null>;
  handler: () => void;
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  priority: number;
  ownerDocument: Document;
};

type EscapeKeyEntry = {
  id: symbol;
  handler: (event: KeyboardEvent) => void;
  ref?: RefObject<HTMLElement | null>;
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  priority: number;
  ownerDocument: Document;
};

export interface OverlayStackOptions {
  priority?: number;
  ref?: RefObject<HTMLElement | null>;
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
}

const DEFAULT_OVERLAY_PRIORITY = 1;
const DOCUMENT_POINTER_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true };
const outsideClickEntries: OutsideClickEntry[] = [];
const escapeKeyEntries: EscapeKeyEntry[] = [];
const pointerListenerCounts = new Map<Document, number>();
const keydownListenerCounts = new Map<Document, number>();

function getComposedPath(event: Event): EventTarget[] {
  return typeof event.composedPath === "function" ? event.composedPath() : [];
}

function pathContains(path: EventTarget[], element: HTMLElement | null): boolean {
  if (!element) return false;
  if (path.length > 0) return path.includes(element);
  return false;
}

function isTargetInside(target: Node, element: HTMLElement | null): boolean {
  return element?.contains(target) ?? false;
}

function isInEntry(event: Event, target: Node, entry: OutsideClickEntry): boolean {
  const path = getComposedPath(event);
  if (pathContains(path, entry.ref.current) || isTargetInside(target, entry.ref.current)) return true;
  return entry.excludeRefs?.some((r) => pathContains(path, r.current) || isTargetInside(target, r.current)) ?? false;
}

function getEntryElements(entry: OutsideClickEntry): HTMLElement[] {
  const elements = [entry.ref.current, ...(entry.excludeRefs?.map((ref) => ref.current) ?? [])];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isNestedAbove(entry: OutsideClickEntry, below: OutsideClickEntry): boolean {
  const belowElements = getEntryElements(below);
  return getEntryElements(entry).some((element) =>
    belowElements.some((belowElement) => belowElement !== element && belowElement.contains(element)),
  );
}

function getTopOutsideClickEntry(ownerDocument: Document): OutsideClickEntry | undefined {
  return outsideClickEntries.reduce<OutsideClickEntry | undefined>((top, entry) => {
    if (entry.ownerDocument !== ownerDocument) return top;
    if (!top) return entry;
    if (entry.priority > top.priority) return entry;
    if (entry.priority < top.priority) return top;
    if (isNestedAbove(entry, top)) return entry;
    if (isNestedAbove(top, entry)) return top;
    return entry;
  }, undefined);
}

function getEscapeEntryElements(entry: EscapeKeyEntry): HTMLElement[] {
  const elements = [entry.ref?.current, ...(entry.excludeRefs?.map((ref) => ref.current) ?? [])];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isEscapeNestedAbove(entry: EscapeKeyEntry, below: EscapeKeyEntry): boolean {
  const belowElements = getEscapeEntryElements(below);
  return getEscapeEntryElements(entry).some((element) =>
    belowElements.some((belowElement) => belowElement !== element && belowElement.contains(element)),
  );
}

function getTopEscapeKeyEntry(ownerDocument: Document): EscapeKeyEntry | undefined {
  return escapeKeyEntries.reduce<EscapeKeyEntry | undefined>((top, entry) => {
    if (entry.ownerDocument !== ownerDocument) return top;
    if (!top) return entry;
    if (entry.priority > top.priority) return entry;
    if (entry.priority < top.priority) return top;
    if (isEscapeNestedAbove(entry, top)) return entry;
    if (isEscapeNestedAbove(top, entry)) return top;
    return entry;
  }, undefined);
}

let lastTouchTarget: EventTarget | null = null;
let lastTouchTime = 0;

function supportsPointerEvents(ownerDocument: Document): boolean {
  const view = ownerDocument.defaultView;
  return view != null && typeof view.PointerEvent !== "undefined";
}

function isDuplicateTouchFallback(event: Event): boolean {
  if (event.type === "touchstart") {
    lastTouchTarget = event.target;
    lastTouchTime = Date.now();
    return false;
  }

  const isDuplicate = event.type === "mousedown" && lastTouchTarget === event.target && Date.now() - lastTouchTime < 750;
  if (isDuplicate) lastTouchTarget = null;
  return isDuplicate;
}

function makeDocumentOutsidePointerHandler(ownerDocument: Document) {
  return (event: Event) => {
    if (isDuplicateTouchFallback(event)) return;
    if (!(event.target instanceof Node)) return;
    const entry = getTopOutsideClickEntry(ownerDocument);
    if (!entry) return;
    if (isInEntry(event, event.target, entry)) return;
    entry.handler();
  };
}

function makeDocumentKeyDownHandler(ownerDocument: Document) {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.key !== "Escape") return;
    const entry = getTopEscapeKeyEntry(ownerDocument);
    if (!entry) return;
    entry.handler(event);
  };
}

type PointerListenerHandle = {
  handler: (event: Event) => void;
  usesPointerEvents: boolean;
};

const pointerHandlers = new Map<Document, PointerListenerHandle>();
const keydownHandlers = new Map<Document, (event: KeyboardEvent) => void>();

function attachPointerListeners(ownerDocument: Document) {
  const next = (pointerListenerCounts.get(ownerDocument) ?? 0) + 1;
  pointerListenerCounts.set(ownerDocument, next);
  if (next > 1) return;

  const handler = makeDocumentOutsidePointerHandler(ownerDocument);
  const usesPointerEvents = supportsPointerEvents(ownerDocument);
  pointerHandlers.set(ownerDocument, { handler, usesPointerEvents });
  if (usesPointerEvents) {
    ownerDocument.addEventListener("pointerdown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
  } else {
    ownerDocument.addEventListener("touchstart", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    ownerDocument.addEventListener("mousedown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
  }
}

function detachPointerListeners(ownerDocument: Document) {
  const current = pointerListenerCounts.get(ownerDocument) ?? 0;
  if (current <= 0) return;
  const next = current - 1;
  if (next > 0) {
    pointerListenerCounts.set(ownerDocument, next);
    return;
  }
  pointerListenerCounts.delete(ownerDocument);
  const stored = pointerHandlers.get(ownerDocument);
  pointerHandlers.delete(ownerDocument);
  if (!stored) return;
  if (stored.usesPointerEvents) {
    ownerDocument.removeEventListener("pointerdown", stored.handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
  } else {
    ownerDocument.removeEventListener("touchstart", stored.handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    ownerDocument.removeEventListener("mousedown", stored.handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
  }
}

function attachKeydownListener(ownerDocument: Document) {
  const next = (keydownListenerCounts.get(ownerDocument) ?? 0) + 1;
  keydownListenerCounts.set(ownerDocument, next);
  if (next > 1) return;

  const handler = makeDocumentKeyDownHandler(ownerDocument);
  keydownHandlers.set(ownerDocument, handler);
  ownerDocument.addEventListener("keydown", handler);
}

function detachKeydownListener(ownerDocument: Document) {
  const current = keydownListenerCounts.get(ownerDocument) ?? 0;
  if (current <= 0) return;
  const next = current - 1;
  if (next > 0) {
    keydownListenerCounts.set(ownerDocument, next);
    return;
  }
  keydownListenerCounts.delete(ownerDocument);
  const handler = keydownHandlers.get(ownerDocument);
  keydownHandlers.delete(ownerDocument);
  if (!handler) return;
  ownerDocument.removeEventListener("keydown", handler);
}

function removeEntry<Entry extends { id: symbol }>(entries: Entry[], id: symbol) {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index >= 0) entries.splice(index, 1);
}

export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>,
  options?: OverlayStackOptions,
): void {
  const handleOutsideClick = useEffectEvent(handler);

  useEffect(() => {
    if (!enabled) return;
    // Resolve at attach time. The ref points at a portal node owned by the same
    // document tree as the trigger; iframe overlays would otherwise listen on the
    // host document and miss interactions.
    const ownerDocument = ref.current?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    if (!ownerDocument) return;
    const id = Symbol("outside-click-layer");
    outsideClickEntries.push({
      id,
      ref,
      handler: handleOutsideClick,
      excludeRefs,
      priority: options?.priority ?? DEFAULT_OVERLAY_PRIORITY,
      ownerDocument,
    });
    attachPointerListeners(ownerDocument);

    return () => {
      removeEntry(outsideClickEntries, id);
      detachPointerListeners(ownerDocument);
    };
  }, [enabled, excludeRefs, options?.priority, ref]);
}

export function useEscapeKey(
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true,
  options?: OverlayStackOptions,
): void {
  const handleEscape = useEffectEvent(handler);

  useEffect(() => {
    if (!enabled) return;
    const ownerDocument =
      options?.ref?.current?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    if (!ownerDocument) return;
    const id = Symbol("escape-key-layer");
    escapeKeyEntries.push({
      id,
      handler: handleEscape,
      ref: options?.ref,
      excludeRefs: options?.excludeRefs,
      priority: options?.priority ?? DEFAULT_OVERLAY_PRIORITY,
      ownerDocument,
    });
    attachKeydownListener(ownerDocument);

    return () => {
      removeEntry(escapeKeyEntries, id);
      detachKeydownListener(ownerDocument);
    };
  }, [enabled, options?.excludeRefs, options?.priority, options?.ref]);
}
