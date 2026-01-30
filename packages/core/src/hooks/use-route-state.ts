import { useCallback, useSyncExternalStore } from 'react';

type SetState<T> = (value: T | ((prev: T) => T)) => void;

const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

function emitChange(): void {
  subscribers.forEach((callback) => callback());
}

function getSnapshot<T>(key: string, defaultValue: T): T {
  if (routeStateStore.has(key)) {
    return routeStateStore.get(key) as T;
  }
  return defaultValue;
}

function setValue<T>(key: string, value: T): void {
  routeStateStore.set(key, value);
  emitChange();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function useRouteState<T>(
  key: string,
  defaultValue: T
): [T, SetState<T>] {
  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key, defaultValue),
    () => defaultValue
  );

  const setState = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      const currentValue = getSnapshot(key, defaultValue);
      const newValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(currentValue)
          : valueOrUpdater;
      setValue(key, newValue);
    },
    [key, defaultValue]
  );

  return [state, setState];
}

export function clearRouteState(key?: string): void {
  if (key) {
    routeStateStore.delete(key);
  } else {
    routeStateStore.clear();
  }
  emitChange();
}

export function getRouteStateSize(): number {
  return routeStateStore.size;
}
