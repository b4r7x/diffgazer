"use client";

import { useEffect, useRef, type RefObject } from "react";

type OutsideClickEntry = {
  id: symbol;
  ref: RefObject<HTMLElement | null>;
  handlerRef: { current: () => void };
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  priority: number;
};

type EscapeKeyEntry = {
  id: symbol;
  handlerRef: { current: (event: KeyboardEvent) => void };
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

function isInEntry(event: MouseEvent, target: Node, entry: OutsideClickEntry): boolean {
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

function handleDocumentMouseDown(event: MouseEvent) {
  if (!(event.target instanceof Node)) return;
  const entry = getTopOutsideClickEntry();
  if (!entry) return;
  if (isInEntry(event, event.target, entry)) return;
  entry.handlerRef.current();
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.key !== "Escape") return;
  const entry = getTopEscapeKeyEntry();
  if (!entry) return;
  entry.handlerRef.current(event);
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
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const id = Symbol("outside-click-layer");
    outsideClickEntries.push({
      id,
      ref,
      handlerRef,
      excludeRefs,
      priority: options?.priority ?? DEFAULT_OVERLAY_PRIORITY,
    });
    if (outsideClickEntries.length === 1) {
      document.addEventListener("mousedown", handleDocumentMouseDown);
    }

    return () => {
      removeEntry(outsideClickEntries, id);
      if (outsideClickEntries.length === 0) {
        document.removeEventListener("mousedown", handleDocumentMouseDown);
      }
    };
  }, [enabled, excludeRefs, options?.priority, ref]);
}

export function useEscapeKey(
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true,
  options?: OverlayStackOptions,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const id = Symbol("escape-key-layer");
    escapeKeyEntries.push({
      id,
      handlerRef,
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
