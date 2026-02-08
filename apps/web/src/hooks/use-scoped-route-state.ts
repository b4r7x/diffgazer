import { useSyncExternalStore } from "react";
import { useLocation } from "@tanstack/react-router";

export type SetState<T> = (value: T | ((prev: T) => T)) => void;

const MAX_ENTRIES = 100;
const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

function emitChange(): void {
  subscribers.forEach((callback) => callback());
}

function cleanupIfNeeded(): void {
  if (routeStateStore.size <= MAX_ENTRIES) return;

  const keysToRemove = Array.from(routeStateStore.keys()).slice(
    0,
    routeStateStore.size - MAX_ENTRIES
  );
  keysToRemove.forEach((key) => routeStateStore.delete(key));
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
  cleanupIfNeeded();
  emitChange();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function useScopedRouteState<T>(
  key: string,
  defaultValue: T
): [T, SetState<T>] {
  const { pathname } = useLocation();
  const storageKey = createStorageKey(key, pathname);

  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(storageKey, defaultValue),
    () => defaultValue
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
