"use client";

import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from "react";

type ExcludeRefs = ReadonlyArray<RefObject<HTMLElement | null>> | undefined;

type OutsideClickEntry = {
  id: symbol;
  ref: RefObject<HTMLElement | null>;
  handler: () => void;
  // Read through a ref so an inline excludeRefs array does not re-register the
  // stack entry (and reorder equal-priority tie-breaks) on every consumer render.
  excludeRefsRef: { current: ExcludeRefs };
  priority: number;
  ownerDocument: Document;
};

type EscapeKeyEntry = {
  id: symbol;
  handler: (event: KeyboardEvent) => void;
  ref?: RefObject<HTMLElement | null>;
  excludeRefsRef: { current: ExcludeRefs };
  priority: number;
  ownerDocument: Document;
};

/** Shared stack options for outside-pointer and Escape-key overlay dismissal. */
export interface OverlayStackOptions {
  /** Higher priority entries receive the dismiss event before lower priority entries. @default 1 */
  priority?: number;
  /** Element ref used for ownerDocument resolution and nested-overlay ordering. */
  ref?: RefObject<HTMLElement | null>;
  /** Additional refs treated as part of the overlay for dismissal and stack ordering. */
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
}

const DEFAULT_OVERLAY_PRIORITY = 1;
const CLICK_SWALLOW_TIMEOUT_MS = 750;
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
  if (pathContains(path, entry.ref.current) || isTargetInside(target, entry.ref.current))
    return true;
  return (
    entry.excludeRefsRef.current?.some(
      (r) => pathContains(path, r.current) || isTargetInside(target, r.current),
    ) ?? false
  );
}

function getEntryElements(entry: OutsideClickEntry): HTMLElement[] {
  const elements = [
    entry.ref.current,
    ...(entry.excludeRefsRef.current?.map((ref) => ref.current) ?? []),
  ];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isNestedAbove(entry: OutsideClickEntry, below: OutsideClickEntry): boolean {
  const belowElements = getEntryElements(below);
  return getEntryElements(entry).some((element) =>
    belowElements.some(
      (belowElement) => belowElement !== element && belowElement.contains(element),
    ),
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
  const elements = [
    entry.ref?.current,
    ...(entry.excludeRefsRef.current?.map((ref) => ref.current) ?? []),
  ];
  return elements.filter((element): element is HTMLElement => element != null);
}

function isEscapeNestedAbove(entry: EscapeKeyEntry, below: EscapeKeyEntry): boolean {
  const belowElements = getEscapeEntryElements(below);
  return getEscapeEntryElements(entry).some((element) =>
    belowElements.some(
      (belowElement) => belowElement !== element && belowElement.contains(element),
    ),
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
    if (isInEntry(event, event.target, entry)) return;
    swallowNextClick(ownerDocument, View, event.type);
    entry.handler();
  };
}

function makeDocumentKeyDownHandler(ownerDocument: Document) {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.key !== "Escape") return;
    if (event.isComposing || event.keyCode === 229) return;
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
    ownerDocument.removeEventListener(
      "pointerdown",
      stored.handler,
      DOCUMENT_POINTER_LISTENER_OPTIONS,
    );
  } else {
    ownerDocument.removeEventListener(
      "touchstart",
      stored.handler,
      DOCUMENT_POINTER_LISTENER_OPTIONS,
    );
    ownerDocument.removeEventListener(
      "mousedown",
      stored.handler,
      DOCUMENT_POINTER_LISTENER_OPTIONS,
    );
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

/** Detects pointer presses outside a referenced element. */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>,
  options?: OverlayStackOptions,
): void {
  const handleOutsideClick = useEffectEvent(handler);
  // Keep the latest excludeRefs without making it an effect dep, so an inline
  // array does not re-register (and reorder) the stack entry every render.
  const excludeRefsRef = useRef<ExcludeRefs>(excludeRefs);
  const priority = options?.priority ?? DEFAULT_OVERLAY_PRIORITY;

  useLayoutEffect(() => {
    excludeRefsRef.current = excludeRefs;
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    // Resolve after commit so portaled nodes exist and expose their ownerDocument.
    const ownerDocument = ref.current?.ownerDocument;
    if (!ownerDocument) return;
    const id = Symbol("outside-click-layer");
    outsideClickEntries.push({
      id,
      ref,
      handler: handleOutsideClick,
      excludeRefsRef,
      priority,
      ownerDocument,
    });
    attachPointerListeners(ownerDocument);

    return () => {
      removeEntry(outsideClickEntries, id);
      detachPointerListeners(ownerDocument);
    };
  }, [enabled, priority, ref]);
}

/** Registers an Escape-key dismissal handler in the shared overlay stack. */
export function useEscapeKey(
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true,
  options?: OverlayStackOptions,
): void {
  const handleEscape = useEffectEvent(handler);
  const optionsRef = options?.ref;
  const priority = options?.priority ?? DEFAULT_OVERLAY_PRIORITY;
  // Keep the latest excludeRefs off the effect deps (inline arrays/objects
  // otherwise re-register the stack entry on every render).
  const excludeRefsRef = useRef<ExcludeRefs>(options?.excludeRefs);

  useLayoutEffect(() => {
    excludeRefsRef.current = options?.excludeRefs;
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    const ownerDocument =
      optionsRef?.current?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    if (!ownerDocument) return;
    const id = Symbol("escape-key-layer");
    escapeKeyEntries.push({
      id,
      handler: handleEscape,
      ref: optionsRef,
      excludeRefsRef,
      priority,
      ownerDocument,
    });
    attachKeydownListener(ownerDocument);

    return () => {
      removeEntry(escapeKeyEntries, id);
      detachKeydownListener(ownerDocument);
    };
  }, [enabled, priority, optionsRef]);
}
