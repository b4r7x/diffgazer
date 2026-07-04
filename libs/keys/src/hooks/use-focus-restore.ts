"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getRestorableFocusTarget,
  type RestoreFocusOptions,
  restoreFocus,
} from "../dom/focus-restore.js";

/** Options for capturing and restoring focus around temporary UI. */
export interface UseFocusRestoreOptions extends RestoreFocusOptions {
  /** Whether capture and restore are active. */
  enabled?: boolean;
  /** Restore focus during cleanup if capture was called and restore was not called manually. */
  restoreOnUnmount?: boolean;
  /** Fallback element to focus when the captured target is unavailable. */
  fallback?: HTMLElement | null;
}

/** Return value from `useFocusRestore`. */
export interface UseFocusRestoreReturn {
  /** Stores the current focus target for the provided document. */
  capture: (ownerDocument?: Document) => HTMLElement | null;
  /** Focuses the captured or fallback target and returns whether focus moved. */
  restore: () => boolean;
  /** The last captured focus target, or null when nothing is captured. */
  target: HTMLElement | null;
}

interface FocusRestoreEntry {
  target: HTMLElement | null;
  ownerDocument: Document;
}

const focusRestoreStacks = new WeakMap<Document, FocusRestoreEntry[]>();

function getDefaultDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

function getFocusRestoreStack(ownerDocument: Document): FocusRestoreEntry[] {
  let stack = focusRestoreStacks.get(ownerDocument);
  if (!stack) {
    stack = [];
    focusRestoreStacks.set(ownerDocument, stack);
  }
  return stack;
}

function removeEntry(entry: FocusRestoreEntry): void {
  const stack = getFocusRestoreStack(entry.ownerDocument);
  const index = stack.lastIndexOf(entry);
  if (index >= 0) stack.splice(index, 1);
}

function resolveOptions(options: UseFocusRestoreOptions): Required<UseFocusRestoreOptions> {
  return {
    enabled: options.enabled ?? true,
    restoreOnUnmount: options.restoreOnUnmount ?? true,
    preventScroll: options.preventScroll ?? false,
    fallback: options.fallback ?? null,
  };
}

function releaseEntry(
  entry: FocusRestoreEntry,
  shouldRestore: boolean,
  options: Required<UseFocusRestoreOptions>,
): boolean {
  const stack = getFocusRestoreStack(entry.ownerDocument);
  const isTopEntry = stack.at(-1) === entry;
  removeEntry(entry);

  if (!shouldRestore || !options.enabled || !isTopEntry) return false;

  return (
    restoreFocus(entry.target, { preventScroll: options.preventScroll }) ||
    restoreFocus(options.fallback, { preventScroll: options.preventScroll })
  );
}

/**
 * Captures the current focus target and restores it later, with per-document
 * stack ordering for nested overlays.
 */
export function useFocusRestore(options: UseFocusRestoreOptions = {}): UseFocusRestoreReturn {
  const resolvedOptions = resolveOptions(options);
  const optionsRef = useRef(resolvedOptions);
  const entryRef = useRef<FocusRestoreEntry | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    optionsRef.current = resolvedOptions;
  });

  const capture = useCallback((ownerDocument?: Document) => {
    const resolvedOptions = optionsRef.current;
    if (!resolvedOptions.enabled) {
      const entry = entryRef.current;
      if (entry) {
        entryRef.current = null;
        removeEntry(entry);
      }
      setTarget(null);
      return null;
    }

    const doc = ownerDocument ?? resolvedOptions.fallback?.ownerDocument ?? getDefaultDocument();
    if (!doc) {
      const entry = entryRef.current;
      if (entry) {
        entryRef.current = null;
        removeEntry(entry);
      }
      setTarget(null);
      return null;
    }

    const nextTarget = getRestorableFocusTarget(doc) ?? resolvedOptions.fallback;
    const entry = entryRef.current ?? { target: null, ownerDocument: doc };

    removeEntry(entry);
    entry.target = nextTarget;
    entry.ownerDocument = doc;
    entryRef.current = entry;
    getFocusRestoreStack(doc).push(entry);
    setTarget(nextTarget);

    return nextTarget;
  }, []);

  const restore = useCallback(() => {
    const resolvedOptions = optionsRef.current;
    const entry = entryRef.current;

    if (!entry) {
      return resolvedOptions.enabled
        ? restoreFocus(resolvedOptions.fallback, { preventScroll: resolvedOptions.preventScroll })
        : false;
    }

    entryRef.current = null;
    const restored = releaseEntry(entry, true, resolvedOptions);
    setTarget(null);
    return restored;
  }, []);

  useEffect(() => {
    if (resolvedOptions.enabled) return;

    const entry = entryRef.current;
    if (!entry) return;

    entryRef.current = null;
    removeEntry(entry);
    setTarget(null);
  }, [resolvedOptions.enabled]);

  useEffect(() => {
    return () => {
      const entry = entryRef.current;
      if (!entry) return;

      entryRef.current = null;
      releaseEntry(entry, optionsRef.current.restoreOnUnmount, optionsRef.current);
    };
  }, []);

  return { capture, restore, target };
}
