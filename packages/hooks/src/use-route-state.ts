import { useCallback, useSyncExternalStore } from 'react';

export type SetState<T> = (value: T | ((prev: T) => T)) => void;

export interface RouteStateOptions {
  scope?: string;
}

const MAX_ENTRIES = 100;
const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

function emitChange(): void {
  subscribers.forEach((callback) => callback());
}

function cleanupIfNeeded(): void {
  if (routeStateStore.size > MAX_ENTRIES) {
    const keysToRemove = Array.from(routeStateStore.keys()).slice(
      0,
      routeStateStore.size - MAX_ENTRIES
    );
    keysToRemove.forEach((key) => routeStateStore.delete(key));
  }
}

function createStorageKey(key: string, scope?: string): string {
  if (!scope) return key;
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
  cleanupIfNeeded();
  emitChange();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function useRouteState<T>(
  key: string,
  defaultValue: T,
  options?: RouteStateOptions
): [T, SetState<T>] {
  const storageKey = createStorageKey(key, options?.scope);

  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(storageKey, defaultValue),
    () => defaultValue
  );

  const setState = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      const currentValue = getSnapshot(storageKey, defaultValue);
      const newValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(currentValue)
          : valueOrUpdater;
      setValue(storageKey, newValue);
    },
    [storageKey, defaultValue]
  );

  return [state, setState];
}

export function clearRouteState(scope?: string): void {
  if (!scope) {
    // Clear all if no scope provided
    routeStateStore.clear();
  } else {
    // Clear all keys matching the scope prefix
    const keysToDelete: string[] = [];
    routeStateStore.forEach((_, key) => {
      if (key.startsWith(`${scope}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => routeStateStore.delete(key));
  }
  emitChange();
}

export function clearAllRouteState(): void {
  routeStateStore.clear();
  emitChange();
}

export function getRouteStateSize(): number {
  return routeStateStore.size;
}
