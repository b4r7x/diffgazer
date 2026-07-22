"use client";

import type { RefObject } from "react";

export type ExcludeRefs = ReadonlyArray<RefObject<HTMLElement | null>> | undefined;

type OutsideClickEntry = {
  id: symbol;
  ref: RefObject<HTMLElement | null>;
  node: HTMLElement;
  handler: () => void;
  excludeRefsRef: { current: ExcludeRefs };
  priority: number;
  ownerDocuments: Set<Document>;
};

type EscapeKeyEntry = {
  id: symbol;
  handler: (event: KeyboardEvent) => void;
  ref?: RefObject<HTMLElement | null>;
  excludeRefsRef: { current: ExcludeRefs };
  containsRef: { current: ((target: Node | null) => boolean) | undefined };
  priority: number;
  ownerDocument: Document;
};

export type OutsideClickLayerHandle = OutsideClickEntry;

export type RegisterOutsideClickLayerParams = {
  ref: RefObject<HTMLElement | null>;
  node: HTMLElement;
  handler: () => void;
  excludeRefsRef: { current: ExcludeRefs };
  priority: number;
  ownerDocuments: Set<Document>;
};

export type UpdateOutsideClickLayerParams = {
  ref: RefObject<HTMLElement | null>;
  handler: () => void;
  ownerDocuments: Set<Document>;
};

export type RegisterEscapeKeyLayerParams = {
  handler: (event: KeyboardEvent) => void;
  ref?: RefObject<HTMLElement | null>;
  excludeRefsRef: { current: ExcludeRefs };
  containsRef: { current: ((target: Node | null) => boolean) | undefined };
  priority: number;
  ownerDocument: Document;
};

export type EscapeKeyLayerHandle = {
  id: symbol;
  ownerDocument: Document;
};

export const DEFAULT_OVERLAY_PRIORITY = 1;
const CLICK_SWALLOW_TIMEOUT_MS = 750;
const DOCUMENT_POINTER_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true };
const outsideClickEntries: OutsideClickEntry[] = [];
const escapeKeyEntries: EscapeKeyEntry[] = [];
const pointerListenerCounts = new Map<Document, number>();
const keydownListenerCounts = new Map<Document, number>();
const handledPointerEvents = new WeakSet<Event>();

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
  if (pathContains(path, entry.node) || isTargetInside(target, entry.node)) return true;
  return (
    entry.excludeRefsRef.current?.some(
      (r) => pathContains(path, r.current) || isTargetInside(target, r.current),
    ) ?? false
  );
}

function getEntryElements(entry: OutsideClickEntry): HTMLElement[] {
  const elements = [entry.node, ...(entry.excludeRefsRef.current?.map((ref) => ref.current) ?? [])];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isNestedAbove<Entry>(
  entry: Entry,
  below: Entry,
  getElements: (entry: Entry) => HTMLElement[],
): boolean {
  const belowElements = getElements(below);
  return getElements(entry).some((element) =>
    belowElements.some(
      (belowElement) => belowElement !== element && belowElement.contains(element),
    ),
  );
}

function getEscapeEntryElements(entry: EscapeKeyEntry): HTMLElement[] {
  const elements = [
    entry.ref?.current,
    ...(entry.excludeRefsRef.current?.map((ref) => ref.current) ?? []),
  ];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isEscapeTargetInsideEntry(entry: EscapeKeyEntry, target: Node | null): boolean {
  if (entry.containsRef.current?.(target) === true) return true;
  if (target === null) return false;
  return getEscapeEntryElements(entry).some((element) => element.contains(target));
}

function isEscapeTargetInsideAnyEntry(ownerDocument: Document, target: Node | null): boolean {
  return escapeKeyEntries.some(
    (entry) => entry.ownerDocument === ownerDocument && isEscapeTargetInsideEntry(entry, target),
  );
}

function getTopEntry<Entry extends { priority: number }>(
  entries: Entry[],
  getElements: (entry: Entry) => HTMLElement[],
  isEligible: (entry: Entry) => boolean,
): Entry | undefined {
  return entries.reduce<Entry | undefined>((top, entry) => {
    if (!isEligible(entry)) return top;
    if (!top) return entry;
    if (entry.priority > top.priority) return entry;
    if (entry.priority < top.priority) return top;
    if (isNestedAbove(entry, top, getElements)) return entry;
    if (isNestedAbove(top, entry, getElements)) return top;
    return entry;
  }, undefined);
}

function getTopOutsideClickEntry(ownerDocument: Document): OutsideClickEntry | undefined {
  return getTopEntry(outsideClickEntries, getEntryElements, (entry) => {
    if (!entry.ownerDocuments.has(ownerDocument)) return false;
    if (entry.ref.current !== entry.node) return false;
    return entry.node.isConnected && entry.ownerDocuments.has(entry.node.ownerDocument);
  });
}

function getTopEscapeKeyEntry(
  ownerDocument: Document,
  target: Node | null,
): EscapeKeyEntry | undefined {
  const routedEntries = escapeKeyEntries.filter(
    (entry) => entry.ownerDocument === ownerDocument && entry.containsRef.current?.(target),
  );
  const entries = routedEntries.length > 0 ? routedEntries : escapeKeyEntries;
  return getTopEntry(entries, getEscapeEntryElements, (entry) => {
    if (entry.ownerDocument !== ownerDocument) return false;
    return routedEntries.length === 0 || entry.containsRef.current?.(target) === true;
  });
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

  const isDuplicate =
    event.type === "mousedown" &&
    lastTouchTarget === event.target &&
    Date.now() - lastTouchTime < 750;
  if (isDuplicate) lastTouchTarget = null;
  return isDuplicate;
}

// After an outside-pointerdown dismisses a layer, swallow the same gesture's
// follow-up click exactly once so the press that closed a select/popover cannot
// also close a dialog under it (backdrop-click path) or activate an underlying
// link/button (click-through). Radix's "one layer per outside press" contract.
function getGestureCleanupTypes(pressType: string) {
  if (pressType === "pointerdown") {
    return {
      nextPressTypes: ["pointerdown"],
      releaseTypes: ["pointerup", "pointercancel"],
    };
  }
  if (pressType === "touchstart") {
    return {
      nextPressTypes: ["touchstart"],
      releaseTypes: ["touchend", "touchcancel"],
    };
  }
  return {
    nextPressTypes: ["mousedown"],
    releaseTypes: ["mouseup"],
  };
}

function swallowNextClick(ownerDocument: Document, View: Window, pressType: string): void {
  const { nextPressTypes, releaseTypes } = getGestureCleanupTypes(pressType);
  let removed = false;
  let timer: number | undefined;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    ownerDocument.removeEventListener("click", onClickCapture, true);
    for (const type of nextPressTypes) {
      ownerDocument.removeEventListener(type, onNextPressCapture, true);
    }
    for (const type of releaseTypes) {
      ownerDocument.removeEventListener(type, onPointerUpCapture, true);
    }
    if (timer != null) View.clearTimeout(timer);
  };
  const onClickCapture = (clickEvent: Event) => {
    cleanup();
    clickEvent.preventDefault();
    clickEvent.stopImmediatePropagation();
  };
  const onNextPressCapture = () => {
    cleanup();
  };
  const onPointerUpCapture = () => {
    if (timer != null) View.clearTimeout(timer);
    timer = View.setTimeout(cleanup, CLICK_SWALLOW_TIMEOUT_MS);
  };
  ownerDocument.addEventListener("click", onClickCapture, true);
  for (const type of nextPressTypes) {
    ownerDocument.addEventListener(type, onNextPressCapture, true);
  }
  for (const type of releaseTypes) {
    ownerDocument.addEventListener(type, onPointerUpCapture, true);
  }
}

function makeDocumentOutsidePointerHandler(ownerDocument: Document) {
  const View = ownerDocument.defaultView;
  return (event: Event) => {
    if (isDuplicateTouchFallback(event)) return;
    if (!View || !(event.target instanceof View.Node)) return;
    const entry = getTopOutsideClickEntry(ownerDocument);
    if (!entry) return;
    if (handledPointerEvents.has(event)) return;
    handledPointerEvents.add(event);
    if (isInEntry(event, event.target, entry)) return;
    swallowNextClick(ownerDocument, View, event.type);
    entry.handler();
  };
}

function makeDocumentKeyDownHandler(ownerDocument: Document) {
  return (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (event.isComposing || event.keyCode === 229) return;
    const NodeCtor = ownerDocument.defaultView?.Node;
    const target = NodeCtor && event.target instanceof NodeCtor ? event.target : null;
    if (event.defaultPrevented && isEscapeTargetInsideAnyEntry(ownerDocument, target)) return;
    const entry = getTopEscapeKeyEntry(ownerDocument, target);
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

function refCountedDocumentListener<Handler>(
  counts: Map<Document, number>,
  handlers: Map<Document, Handler>,
  attach: (ownerDocument: Document, handler: Handler) => void,
  detach: (ownerDocument: Document, handler: Handler) => void,
) {
  return {
    add(ownerDocument: Document, handler: Handler): void {
      const count = counts.get(ownerDocument) ?? 0;
      counts.set(ownerDocument, count + 1);
      if (count > 0) return;
      handlers.set(ownerDocument, handler);
      attach(ownerDocument, handler);
    },
    remove(ownerDocument: Document): void {
      const count = counts.get(ownerDocument) ?? 0;
      if (count <= 0) return;
      if (count > 1) {
        counts.set(ownerDocument, count - 1);
        return;
      }
      counts.delete(ownerDocument);
      const handler = handlers.get(ownerDocument);
      handlers.delete(ownerDocument);
      if (handler) detach(ownerDocument, handler);
    },
  };
}

const pointerListeners = refCountedDocumentListener(
  pointerListenerCounts,
  pointerHandlers,
  (ownerDocument, { handler, usesPointerEvents }) => {
    if (usesPointerEvents) {
      ownerDocument.addEventListener("pointerdown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    } else {
      ownerDocument.addEventListener("touchstart", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
      ownerDocument.addEventListener("mousedown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    }
  },
  (ownerDocument, { handler, usesPointerEvents }) => {
    if (usesPointerEvents) {
      ownerDocument.removeEventListener("pointerdown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    } else {
      ownerDocument.removeEventListener("touchstart", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
      ownerDocument.removeEventListener("mousedown", handler, DOCUMENT_POINTER_LISTENER_OPTIONS);
    }
  },
);

const keydownListeners = refCountedDocumentListener(
  keydownListenerCounts,
  keydownHandlers,
  (ownerDocument, handler) => ownerDocument.addEventListener("keydown", handler),
  (ownerDocument, handler) => ownerDocument.removeEventListener("keydown", handler),
);

function attachPointerListeners(ownerDocument: Document): void {
  pointerListeners.add(ownerDocument, {
    handler: makeDocumentOutsidePointerHandler(ownerDocument),
    usesPointerEvents: supportsPointerEvents(ownerDocument),
  });
}

function detachPointerListeners(ownerDocument: Document): void {
  pointerListeners.remove(ownerDocument);
}

function attachKeydownListener(ownerDocument: Document): void {
  keydownListeners.add(ownerDocument, makeDocumentKeyDownHandler(ownerDocument));
}

function detachKeydownListeners(ownerDocument: Document): void {
  keydownListeners.remove(ownerDocument);
}

function removeEntry<Entry extends { id: symbol }>(entries: Entry[], id: symbol) {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index >= 0) entries.splice(index, 1);
}

function syncOutsideClickDocuments(
  entry: OutsideClickEntry,
  nextOwnerDocuments: Set<Document>,
): void {
  for (const ownerDocument of entry.ownerDocuments) {
    if (!nextOwnerDocuments.has(ownerDocument)) detachPointerListeners(ownerDocument);
  }
  for (const ownerDocument of nextOwnerDocuments) {
    if (!entry.ownerDocuments.has(ownerDocument)) attachPointerListeners(ownerDocument);
  }
  entry.ownerDocuments = nextOwnerDocuments;
}

export function getOutsideClickDocuments(
  node: HTMLElement,
  excludeRefs: ExcludeRefs,
): Set<Document> {
  const ownerDocuments = new Set<Document>([node.ownerDocument]);
  for (const excludeRef of excludeRefs ?? []) {
    if (excludeRef.current) ownerDocuments.add(excludeRef.current.ownerDocument);
  }
  return ownerDocuments;
}

export function registerOutsideClickLayer(
  params: RegisterOutsideClickLayerParams,
): OutsideClickLayerHandle {
  const entry: OutsideClickEntry = {
    id: Symbol("outside-click-layer"),
    ref: params.ref,
    node: params.node,
    handler: params.handler,
    excludeRefsRef: params.excludeRefsRef,
    priority: params.priority,
    ownerDocuments: params.ownerDocuments,
  };
  outsideClickEntries.push(entry);
  for (const ownerDocument of params.ownerDocuments) attachPointerListeners(ownerDocument);
  return entry;
}

export function updateOutsideClickLayer(
  entry: OutsideClickLayerHandle,
  params: UpdateOutsideClickLayerParams,
): void {
  entry.ref = params.ref;
  entry.handler = params.handler;
  syncOutsideClickDocuments(entry, params.ownerDocuments);
}

export function disposeOutsideClickLayer(entry: OutsideClickLayerHandle): void {
  removeEntry(outsideClickEntries, entry.id);
  for (const ownerDocument of entry.ownerDocuments) detachPointerListeners(ownerDocument);
}

export function registerEscapeKeyLayer(
  params: RegisterEscapeKeyLayerParams,
): EscapeKeyLayerHandle {
  const id = Symbol("escape-key-layer");
  escapeKeyEntries.push({
    id,
    handler: params.handler,
    ref: params.ref,
    excludeRefsRef: params.excludeRefsRef,
    containsRef: params.containsRef,
    priority: params.priority,
    ownerDocument: params.ownerDocument,
  });
  attachKeydownListener(params.ownerDocument);
  return { id, ownerDocument: params.ownerDocument };
}

export function disposeEscapeKeyLayer(handle: EscapeKeyLayerHandle): void {
  removeEntry(escapeKeyEntries, handle.id);
  detachKeydownListeners(handle.ownerDocument);
}
