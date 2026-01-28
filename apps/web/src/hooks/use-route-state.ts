import { useCallback, useSyncExternalStore } from 'react';
import { useLocation } from '@tanstack/react-router';

const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

interface RouteStateConfig {
  maxEntries?: number;
}

let config: RouteStateConfig = { maxEntries: 100 };

export function configureRouteState(options: RouteStateConfig): void {
  config = { ...config, ...options };
}

function emitChange(): void {
  subscribers.forEach((callback) => callback());
}

function cleanupIfNeeded(): void {
  if (config.maxEntries && routeStateStore.size > config.maxEntries) {
    const keysToRemove = Array.from(routeStateStore.keys()).slice(
      0,
      routeStateStore.size - config.maxEntries
    );
    keysToRemove.forEach((key) => routeStateStore.delete(key));
  }
}

function getStorageKey(pathname: string, key: string): string {
  return `${pathname}:${key}`;
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
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const { pathname } = useLocation();
  const storageKey = getStorageKey(pathname, key);

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

export function clearAllRouteState(): void {
  routeStateStore.clear();
  emitChange();
}

export function clearRouteState(pathname: string): void {
  const keysToDelete: string[] = [];
  routeStateStore.forEach((_, key) => {
    if (key.startsWith(`${pathname}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => routeStateStore.delete(key));
  emitChange();
}

export function getRouteStateSize(): number {
  return routeStateStore.size;
}
