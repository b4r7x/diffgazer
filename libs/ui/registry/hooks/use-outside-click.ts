"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

type OutsideClickEntry = {
  id: symbol;
  ref: RefObject<HTMLElement | null>;
  handler: () => void;
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  priority: number;
};

type EscapeKeyEntry = {
  id: symbol;
  handler: (event: KeyboardEvent) => void;
  ref?: RefObject<HTMLElement | null>;
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  priority: number;
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

function getTopOutsideClickEntry(): OutsideClickEntry | undefined {
  return outsideClickEntries.reduce<OutsideClickEntry | undefined>((top, entry) => {
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

function getTopEscapeKeyEntry(): EscapeKeyEntry | undefined {
  return escapeKeyEntries.reduce<EscapeKeyEntry | undefined>((top, entry) => {
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

function supportsPointerEvents(): boolean {
  return typeof window !== "undefined" && typeof window.PointerEvent !== "undefined";
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

function handleDocumentOutsidePointer(event: Event) {
  if (isDuplicateTouchFallback(event)) return;
  if (!(event.target instanceof Node)) return;
  const entry = getTopOutsideClickEntry();
  if (!entry) return;
  if (isInEntry(event, event.target, entry)) return;
  entry.handler();
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.key !== "Escape") return;
  const entry = getTopEscapeKeyEntry();
  if (!entry) return;
  entry.handler(event);
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
    const id = Symbol("outside-click-layer");
    const usePointerEvents = supportsPointerEvents();
    outsideClickEntries.push({
      id,
      ref,
      handler: handleOutsideClick,
      excludeRefs,
      priority: options?.priority ?? DEFAULT_OVERLAY_PRIORITY,
    });
    if (outsideClickEntries.length === 1) {
      if (usePointerEvents) {
        document.addEventListener("pointerdown", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
      } else {
        document.addEventListener("touchstart", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
        document.addEventListener("mousedown", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
      }
    }

    return () => {
      removeEntry(outsideClickEntries, id);
      if (outsideClickEntries.length === 0) {
        if (usePointerEvents) {
          document.removeEventListener("pointerdown", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
        } else {
          document.removeEventListener("touchstart", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
          document.removeEventListener("mousedown", handleDocumentOutsidePointer, DOCUMENT_POINTER_LISTENER_OPTIONS);
        }
      }
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
    const id = Symbol("escape-key-layer");
    escapeKeyEntries.push({
      id,
      handler: handleEscape,
      ref: options?.ref,
      excludeRefs: options?.excludeRefs,
      priority: options?.priority ?? DEFAULT_OVERLAY_PRIORITY,
    });
    if (escapeKeyEntries.length === 1) {
      document.addEventListener("keydown", handleDocumentKeyDown);
    }

    return () => {
      removeEntry(escapeKeyEntries, id);
      if (escapeKeyEntries.length === 0) {
        document.removeEventListener("keydown", handleDocumentKeyDown);
      }
    };
  }, [enabled, options?.excludeRefs, options?.priority, options?.ref]);
}
