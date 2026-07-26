import { useLocation } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

// Scoped-route-state keys each page owns, shared so the home menu's per-route
// reset list cannot drift from the keys those pages actually store.
export const HISTORY_RUN_KEY = "run";
export const HISTORY_DATE_KEY = "date";
export const SETTINGS_HIGHLIGHTED_KEY = "highlighted";

const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

function emitChange(): void {
  subscribers.forEach((callback) => {
    callback();
  });
}

function createStorageKey(key: string, scope: string): string {
  return `${scope}:${key}`;
}

function getSnapshot<T>(storageKey: string, defaultValue: T): T {
  if (routeStateStore.has(storageKey)) {
    return routeStateStore.get(storageKey) as T;
  }
  return defaultValue;
}

function setValue<T>(storageKey: string, value: T): void {
  routeStateStore.set(storageKey, value);
  emitChange();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Per-pathname state store backed by useSyncExternalStore.
 *
 * `defaultValue` MUST be a primitive (or a stably-identified reference). On a
 * cache miss both snapshots return the argument verbatim, so a fresh non-primitive
 * default (e.g. an inline `[]` or `{}`) yields a new snapshot identity every render
 * — useSyncExternalStore's documented infinite-loop failure. Hoist non-primitive
 * defaults to a module constant or memo before passing them here.
 */
export function useScopedRouteState<T>(key: string, defaultValue: T): [T, SetState<T>] {
  const { pathname } = useLocation();
  const storageKey = createStorageKey(key, pathname);

  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(storageKey, defaultValue),
    () => defaultValue,
  );

  const setState = (valueOrUpdater: T | ((prev: T) => T)) => {
    const currentValue = getSnapshot(storageKey, defaultValue);
    const newValue =
      typeof valueOrUpdater === "function"
        ? (valueOrUpdater as (prev: T) => T)(currentValue)
        : valueOrUpdater;
    setValue(storageKey, newValue);
  };

  return [state, setState];
}

export function clearScopedRouteState(scope: string, key: string): void {
  const storageKey = createStorageKey(key, scope);
  routeStateStore.delete(storageKey);
  emitChange();
}
