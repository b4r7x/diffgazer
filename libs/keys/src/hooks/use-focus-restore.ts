"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRestorableFocusTarget,
  restoreFocus,
  type RestoreFocusOptions,
} from "../dom/focus-restore.js";

export interface UseFocusRestoreOptions extends RestoreFocusOptions {
  enabled?: boolean;
  restoreOnUnmount?: boolean;
  fallback?: HTMLElement | null;
}

export interface UseFocusRestoreReturn {
  capture: (ownerDocument?: Document) => HTMLElement | null;
  restore: () => boolean;
  target: HTMLElement | null;
}

interface FocusRestoreEntry {
  target: HTMLElement | null;
}

const focusRestoreStack: FocusRestoreEntry[] = [];

function removeEntry(entry: FocusRestoreEntry): void {
  const index = focusRestoreStack.lastIndexOf(entry);
  if (index >= 0) focusRestoreStack.splice(index, 1);
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
  const isTopEntry = focusRestoreStack.at(-1) === entry;
  removeEntry(entry);

  if (!shouldRestore || !options.enabled || !isTopEntry) return false;

  return (
    restoreFocus(entry.target, { preventScroll: options.preventScroll }) ||
    restoreFocus(options.fallback, { preventScroll: options.preventScroll })
  );
}

export function useFocusRestore(
  options: UseFocusRestoreOptions = {},
): UseFocusRestoreReturn {
  const resolvedOptions = resolveOptions(options);
  const optionsRef = useRef(resolvedOptions);
  const entryRef = useRef<FocusRestoreEntry | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  // Stable-ref escape hatch: optionsRef is read ONLY inside capture/restore
  // event-driven callbacks and unmount cleanup (never during render), so
  // mid-render writes are safe under concurrent rendering. See AGENTS.md
  // react-useref rules.
  optionsRef.current = resolvedOptions;

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

    const nextTarget = getRestorableFocusTarget(ownerDocument) ?? resolvedOptions.fallback;
    const entry = entryRef.current ?? { target: null };

    removeEntry(entry);
    entry.target = nextTarget;
    entryRef.current = entry;
    focusRestoreStack.push(entry);
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
